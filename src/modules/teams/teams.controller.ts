import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ROLE } from '../../common/constants/roles.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { TeamsQueryDto } from './teams.dto.js';
import { TeamsService } from './teams.service.js';

@ApiBearerAuth()
@ApiTags('Teams')
@Roles(ROLE.SUPER_ADMIN)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async getTeams(@Query() query: TeamsQueryDto, @Res() res: Response) {
    const result = await this.teamsService.getTeams(query);
    res.status(result.status).json(result);
  }
}
