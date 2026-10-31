import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Result } from '../../common/interfaces/result.interface.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthResult, AuthUser } from '../auth/auth.types.js';
import { EmailTokenService } from '../auth/email-token.service.js';
import { toSafeUser } from '../auth/safe-user.js';
import { TokenService } from '../auth/token.service.js';
import { ChangePasswordDto, UpdateProfileDto } from './profile.dto.js';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly emailTokenService: EmailTokenService,
  ) {}

  async updateProfile(
    authUser: AuthUser,
    dto: UpdateProfileDto,
  ): Promise<Result> {
    // 1. finding the user
    const user = await this.prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { id: true, userName: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. checking the new user name and email are free
    const taken = await this.prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [{ userName: dto.userName }, { email: dto.email }],
      },
      select: { userName: true },
    });

    if (taken) {
      throw new ConflictException(
        taken.userName === dto.userName
          ? 'Username is already taken'
          : 'Email is already registered',
      );
    }

    // 3. saving; a new email has to be verified again
    const emailChanged = dto.email !== user.email;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        userName: dto.userName,
        email: dto.email,
        ...(emailChanged && { emailVerifiedAt: null }),
      },
      include: { roleInfo: true },
    });

    // 4. sending the verify email; a failure must not undo the saved change
    if (emailChanged) {
      await this.emailTokenService
        .sendVerifyEmail(updated)
        .catch((error: unknown) =>
          this.logger.error(
            `Could not send the verify email to user ${updated.uid}: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    }

    return {
      status: HttpStatus.OK,
      message: emailChanged
        ? 'Profile updated. We sent a link to verify your new email.'
        : 'Profile updated successfully',
      data: toSafeUser(updated),
    };
  }

  /**
   * Changes the password and ends every session, then logs this one back in with a new pair.
   * The refresh cookie is only sent to /auth, so this route can't tell which session is the
   * current one; revoking all and issuing a fresh pair keeps the caller logged in.
   */
  async changePassword(
    authUser: AuthUser,
    dto: ChangePasswordDto,
  ): Promise<AuthResult> {
    // 1. checking the current password
    const user = await this.prisma.user.findUnique({
      where: { uid: authUser.uid },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('Current password is incorrect');
    }

    // 2. saving the new password
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
      include: { roleInfo: true },
    });

    // 3. logging out every session, then issuing a new pair for this one
    await this.tokenService.revokeAll(updated.uid);
    const { tokens, ...refresh } = await this.authService.issueTokens(updated);

    return {
      ...refresh,
      result: {
        status: HttpStatus.OK,
        message: 'Password changed. Other sessions were logged out.',
        data: { ...tokens, user: toSafeUser(updated) },
      },
    };
  }
}
