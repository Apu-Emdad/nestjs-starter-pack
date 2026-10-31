import { Body, Controller, Patch, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ErrorMessage } from '../../common/decorators/error-message.decorator.js';
import type { Env } from '../../config/env.js';
import type { AuthUser } from '../auth/auth.types.js';
import { setRefreshCookie } from '../auth/refresh-cookie.js';
import { ChangePasswordDto, UpdateProfileDto } from './profile.dto.js';
import { ProfileService } from './profile.service.js';

@ApiBearerAuth()
@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Patch()
  @ErrorMessage('An error occurred while updating the profile')
  async updateProfile(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: UpdateProfileDto,
    @Res() res: Response,
  ) {
    const result = await this.profileService.updateProfile(authUser, dto);
    res.status(result.status).json(result);
  }

  @Patch('password')
  @ErrorMessage('An error occurred while changing the password')
  async changePassword(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res() res: Response,
  ) {
    const { result, refreshToken, refreshExpiresIn } =
      await this.profileService.changePassword(authUser, dto);
    setRefreshCookie(
      res,
      refreshToken,
      refreshExpiresIn,
      this.config.get('NODE_ENV', { infer: true }) === 'production',
    );
    res.status(result.status).json(result);
  }
}
