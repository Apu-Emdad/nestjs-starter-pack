import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createFakeEmailTokens } from '../../../test/fakes/fake-email-tokens.js';
import { FakeMailService } from '../../../test/fakes/fake-mail.js';
import { FakeRedis } from '../../../test/fakes/fake-redis.js';
import type { Env } from '../../config/env.js';
import type { MailService } from '../../infra/mail/mail.service.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RateLimitService } from '../../infra/redis/rate-limit.service.js';
import type { RedisService } from '../../infra/redis/redis.service.js';
import { AuthService } from '../auth/auth.service.js';
import { EmailTokenService } from '../auth/email-token.service.js';
import { TokenService } from '../auth/token.service.js';
import { ProfileService } from './profile.service.js';

const env: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'a-test-access-secret-at-least-32-chars',
  JWT_REFRESH_SECRET: 'a-test-refresh-secret-at-least-32-chars',
  JWT_ACCESS_EXPIRES_IN: 900,
  JWT_REFRESH_EXPIRES_IN: 604800,
  WEB_URL: 'http://localhost:5173',
};
const USER_UID = 'k3F9x2Mq7A';
const authUser = { uid: USER_UID, userName: 'apu_emdad', role: 'USER' };

async function makeUser(password = 'correct-horse-battery') {
  return {
    id: 1n,
    uid: USER_UID,
    userName: 'apu_emdad',
    email: 'apu@example.com',
    passwordHash: await argon2.hash(password),
    roleId: 1n,
    isActive: true,
    emailVerifiedAt: new Date('2026-10-02T00:00:00Z') as Date | null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date(),
    roleInfo: {
      id: 1n,
      uid: 'role-uid',
      name: 'USER',
      rolePermissions: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe('ProfileService', () => {
  let prisma: {
    user: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    emailToken: ReturnType<typeof createFakeEmailTokens>;
  };
  let redis: FakeRedis;
  let mail: FakeMailService;
  let tokenService: TokenService;
  let profileService: ProfileService;

  beforeEach(() => {
    prisma = {
      user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      emailToken: createFakeEmailTokens(),
    };
    redis = new FakeRedis();
    mail = new FakeMailService();
    const config = {
      get: (key: string) => env[key],
    } as unknown as ConfigService<Env, true>;
    tokenService = new TokenService(
      new JwtService(),
      redis as unknown as RedisService,
      config,
    );
    const emailTokenService = new EmailTokenService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      config,
    );
    const authService = new AuthService(
      prisma as unknown as PrismaService,
      tokenService,
      emailTokenService,
      new RateLimitService(redis as unknown as RedisService),
    );
    profileService = new ProfileService(
      prisma as unknown as PrismaService,
      authService,
      tokenService,
      emailTokenService,
    );
  });

  describe('updateProfile', () => {
    // The update mock returns the user with the new fields applied.
    beforeEach(async () => {
      const user = await makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...user,
          ...data,
        }),
      );
    });

    it('a new email clears the verification and sends a verify link', async () => {
      const result = await profileService.updateProfile(authUser, {
        userName: 'apu_emdad',
        email: 'new@example.com',
      });

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        userName: 'apu_emdad',
        email: 'new@example.com',
        emailVerifiedAt: null,
      });
      expect(result.data).toMatchObject({
        email: 'new@example.com',
        emailVerified: false,
      });
      expect(result.message).toBe(
        'Profile updated. We sent a link to verify your new email.',
      );
      expect(mail.sent.map((m) => [m.kind, m.to])).toEqual([
        ['verify-email', 'new@example.com'],
      ]);
    });

    it('the same email keeps the verification and sends nothing', async () => {
      const result = await profileService.updateProfile(authUser, {
        userName: 'apu_new',
        email: 'apu@example.com',
      });

      expect(prisma.user.update.mock.calls[0][0].data).toEqual({
        userName: 'apu_new',
        email: 'apu@example.com',
      });
      expect(result.data).toMatchObject({
        userName: 'apu_new',
        emailVerified: true,
      });
      expect(mail.sent).toHaveLength(0);
    });

    it('rejects a user name or email used by someone else with 409', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ userName: 'taken_name' });
      await expect(
        profileService.updateProfile(authUser, {
          userName: 'taken_name',
          email: 'apu@example.com',
        }),
      ).rejects.toThrow(new ConflictException('Username is already taken'));

      prisma.user.findFirst.mockResolvedValueOnce({ userName: 'someone' });
      await expect(
        profileService.updateProfile(authUser, {
          userName: 'apu_emdad',
          email: 'taken@example.com',
        }),
      ).rejects.toThrow(new ConflictException('Email is already registered'));

      // The unique check skips the user's own row.
      expect(prisma.user.findFirst.mock.calls[0][0].where.id).toEqual({
        not: 1n,
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('still saves when the verify email can not be sent', async () => {
      mail.fail = true;

      const result = await profileService.updateProfile(authUser, {
        userName: 'apu_emdad',
        email: 'new@example.com',
      });

      expect(result.status).toBe(200);
    });
  });

  describe('changePassword', () => {
    it('rejects a wrong current password with 400', async () => {
      prisma.user.findUnique.mockResolvedValue(await makeUser());

      await expect(
        profileService.changePassword(authUser, {
          currentPassword: 'wrong-password',
          newPassword: 'new-password-123',
        }),
      ).rejects.toThrow(
        new BadRequestException('Current password is incorrect'),
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('saves the new password, ends old sessions and returns a fresh pair', async () => {
      const user = await makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);
      const oldSession = await tokenService.issue({
        sub: USER_UID,
        userName: 'apu_emdad',
        role: 'USER',
      });

      const auth = await profileService.changePassword(authUser, {
        currentPassword: 'correct-horse-battery',
        newPassword: 'new-password-123',
      });

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(await argon2.verify(data.passwordHash, 'new-password-123')).toBe(
        true,
      );
      expect(auth.result.data.accessToken).toEqual(expect.any(String));
      // The new refresh token works; the old one was revoked.
      expect(await tokenService.consume(auth.refreshToken)).toBe(USER_UID);
      await expect(
        tokenService.consume(oldSession.refreshToken),
      ).rejects.toThrow();
    });
  });
});
