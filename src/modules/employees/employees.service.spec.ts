import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { TokenService } from '../auth/token.service.js';
import type { CreateEmployeeDto } from './employees.dto.js';
import { EmployeesService } from './employees.service.js';

const ADMIN: AuthUser = {
  uid: 'admin-uid1',
  userName: 'admin',
  role: 'SUPER_ADMIN',
};
const EMPLOYEE_UID = 'emp-uid-01';

const row = {
  uid: EMPLOYEE_UID,
  fullName: 'Maya Rodriguez',
  bio: null,
  salary: 4500,
  skills: ['React'],
  employmentType: 'FULL_TIME',
  joinDate: new Date('2026-10-01T00:00:00Z'),
  isRemote: false,
  createdAt: new Date('2026-10-20T00:00:00Z'),
  userInfo: { userName: 'maya_r', email: 'maya@example.com', isActive: true },
  teamInfo: { uid: 'team-uid-01', name: 'Frontend', department: 'ENGINEERING' },
};

const createInput = {
  userName: 'maya_r',
  email: 'maya@example.com',
  password: 'correct-horse-battery',
  fullName: 'Maya Rodriguez',
  bio: '',
  salary: 4500,
  teamUid: 'team-uid-01',
  skills: ['React'],
  employmentType: 'FULL_TIME',
  joinDate: '2026-10-01',
};
const createDto = createInput as CreateEmployeeDto;

const futureDate = () => dayjs().add(2, 'day').format('YYYY-MM-DD');

describe('EmployeesService', () => {
  let prisma: {
    employee: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    team: { findUnique: ReturnType<typeof vi.fn> };
    user: {
      findFirst: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };
  let tokenService: { revokeAll: ReturnType<typeof vi.fn> };
  let employeesService: EmployeesService;

  beforeEach(() => {
    prisma = {
      employee: {
        count: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      team: { findUnique: vi.fn().mockResolvedValue({ id: 7n }) },
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    };
    tokenService = { revokeAll: vi.fn() };
    employeesService = new EmployeesService(
      prisma as unknown as PrismaService,
      tokenService as unknown as TokenService,
    );
  });

  describe('getEmployees', () => {
    it('builds the filter, pages and sends joinDate as YYYY-MM-DD', async () => {
      prisma.employee.count.mockResolvedValue(1);
      prisma.employee.findMany.mockResolvedValue([row]);

      const result = await employeesService.getEmployees({
        search: 'maya',
        department: 'ENGINEERING' as never,
        employmentType: 'FULL_TIME' as never,
        isRemote: false,
        page: 2,
        pageSize: 5,
      });

      const contains = { contains: 'maya', mode: 'insensitive' };
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          where: {
            OR: [
              { fullName: contains },
              { userInfo: { userName: contains } },
              { userInfo: { email: contains } },
            ],
            teamInfo: { department: 'ENGINEERING' },
            employmentType: 'FULL_TIME',
            isRemote: false,
          },
        }),
      );
      expect(result.data).toEqual({
        employees: [row],
        total: 1,
      });
    });

    it('uses an empty filter and the first page by default', async () => {
      prisma.employee.count.mockResolvedValue(0);
      prisma.employee.findMany.mockResolvedValue([]);

      await employeesService.getEmployees({});

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10, where: {} }),
      );
    });
  });

  describe('getEmployee', () => {
    it('returns one employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(row);

      const result = await employeesService.getEmployee(EMPLOYEE_UID);

      expect(result.data).toEqual(row);
    });

    it('throws NotFound for an unknown uid', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(employeesService.getEmployee('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createEmployee', () => {
    it('creates the login and the profile, and hashes the password', async () => {
      prisma.employee.create.mockResolvedValue(row);

      const result = await employeesService.createEmployee(createDto);

      const { data } = prisma.employee.create.mock.calls[0][0];
      expect(data.teamInfo).toEqual({ connect: { id: 7n } });
      expect(data.bio).toBeNull();
      expect(data.joinDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
      expect(data.userInfo.create.roleInfo).toEqual({
        connect: { name: 'USER' },
      });
      expect(data.userInfo.create.passwordHash).not.toBe(createDto.password);
      expect(
        await argon2.verify(
          data.userInfo.create.passwordHash,
          createDto.password,
        ),
      ).toBe(true);
      expect(result.status).toBe(201);
    });

    it('throws NotFound for an unknown team', async () => {
      prisma.team.findUnique.mockResolvedValue(null);

      await expect(employeesService.createEmployee(createDto)).rejects.toThrow(
        'Team not found',
      );
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });

    it('rejects a join date in the future', async () => {
      await expect(
        employeesService.createEmployee({
          ...createInput,
          joinDate: futureDate(),
        } as CreateEmployeeDto),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['userName', 'Username is already taken'],
      ['other', 'Email is already registered'],
    ])('throws Conflict when the %s is taken', async (found, message) => {
      prisma.user.findFirst.mockResolvedValue({
        userName: found === 'userName' ? createDto.userName : 'someone_else',
      });

      const promise = employeesService.createEmployee(createDto);

      await expect(promise).rejects.toThrow(ConflictException);
      await expect(promise).rejects.toThrow(message);
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });
  });

  describe('updateEmployee', () => {
    it('updates only the fields that were sent', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 3n });
      prisma.employee.update.mockResolvedValue(row);

      await employeesService.updateEmployee(EMPLOYEE_UID, { salary: 5000 });

      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 3n },
          data: expect.objectContaining({
            salary: 5000,
            fullName: undefined,
            teamId: undefined,
            joinDate: undefined,
          }),
        }),
      );
    });

    it('moves the employee to another team', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 3n });
      prisma.employee.update.mockResolvedValue(row);

      await employeesService.updateEmployee(EMPLOYEE_UID, {
        teamUid: 'team-uid-02',
      });

      expect(prisma.team.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { uid: 'team-uid-02' } }),
      );
      expect(prisma.employee.update.mock.calls[0][0].data.teamId).toBe(7n);
    });

    it('throws NotFound for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        employeesService.updateEmployee('nope', { salary: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteEmployee', () => {
    it('deletes the login and ends their sessions', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        userId: 9n,
        userInfo: { uid: 'user-uid-9' },
      });

      const result = await employeesService.deleteEmployee(EMPLOYEE_UID, ADMIN);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 9n } });
      expect(tokenService.revokeAll).toHaveBeenCalledWith('user-uid-9');
      expect(result.message).toBe('Employee deleted successfully');
    });

    it('does not let an admin delete their own account', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        userId: 1n,
        userInfo: { uid: ADMIN.uid },
      });

      await expect(
        employeesService.deleteEmployee(EMPLOYEE_UID, ADMIN),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(
        employeesService.deleteEmployee('nope', ADMIN),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
