import { HttpStatus, Injectable } from '@nestjs/common';
import type { Result } from '../../common/interfaces/result.interface.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { TeamsQueryDto } from './teams.dto.js';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeams(query: TeamsQueryDto): Promise<Result> {
    const teams = await this.prisma.team.findMany({
      where: query.department ? { department: query.department } : {},
      orderBy: { name: 'asc' },
      select: { uid: true, name: true, department: true },
    });

    return {
      status: HttpStatus.OK,
      message: 'Teams fetched successfully',
      data: { teams },
    };
  }
}
