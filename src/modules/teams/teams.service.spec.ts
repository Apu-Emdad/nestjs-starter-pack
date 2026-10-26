import type { PrismaService } from '../../prisma/prisma.service.js';
import { TeamsService } from './teams.service.js';

const teams = [
  { uid: 'team-uid-01', name: 'Backend', department: 'ENGINEERING' },
  { uid: 'team-uid-02', name: 'Frontend', department: 'ENGINEERING' },
];

describe('TeamsService', () => {
  let prisma: { team: { findMany: ReturnType<typeof vi.fn> } };
  let teamsService: TeamsService;

  beforeEach(() => {
    prisma = { team: { findMany: vi.fn().mockResolvedValue(teams) } };
    teamsService = new TeamsService(prisma as unknown as PrismaService);
  });

  it('returns every team, sorted by name', async () => {
    const result = await teamsService.getTeams({});

    expect(prisma.team.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { name: 'asc' },
      select: { uid: true, name: true, department: true },
    });
    expect(result.data).toEqual({ teams });
  });

  it('filters by department', async () => {
    await teamsService.getTeams({ department: 'DESIGN' as never });

    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { department: 'DESIGN' } }),
    );
  });
});
