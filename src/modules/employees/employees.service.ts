import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import dayjs from 'dayjs';
import { ROLE } from '../../common/constants/roles.js';
import type { Result } from '../../common/interfaces/result.interface.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { TokenService } from '../auth/token.service.js';
import {
  CreateEmployeeDto,
  EmployeesQueryDto,
  UpdateEmployeeDto,
} from './employees.dto.js';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async getEmployees(query: EmployeesQueryDto): Promise<Result> {
    const page = query.page ? query.page - 1 : 0;
    const pageSize = query.pageSize ?? 10;

    const filter: Prisma.EmployeeWhereInput = {};

    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filter.OR = [
        { fullName: contains },
        { userInfo: { userName: contains } },
        { userInfo: { email: contains } },
      ];
    }

    if (query.department) {
      filter.teamInfo = { department: query.department };
    }

    if (query.employmentType) {
      filter.employmentType = query.employmentType;
    }

    if (query.isRemote !== undefined) {
      filter.isRemote = query.isRemote;
    }

    const [total, employees] = await Promise.all([
      this.prisma.employee.count({ where: filter }),
      this.prisma.employee.findMany({
        skip: page * pageSize,
        take: pageSize,
        where: filter,
        orderBy: { createdAt: 'desc' },
        include: { userInfo: true, teamInfo: true },
      }),
    ]);

    return {
      status: HttpStatus.OK,
      message: 'Employees fetched successfully',
      data: { total, employees },
    };
  }

  async getEmployee(uid: string): Promise<Result> {
    const employee = await this.prisma.employee.findUnique({
      where: { uid },
      include: { userInfo: true, teamInfo: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return {
      status: HttpStatus.OK,
      message: 'Employee fetched successfully',
      data: employee,
    };
  }

  async createEmployee(dto: CreateEmployeeDto): Promise<Result> {
    const team = await this.findTeam(dto.teamUid);
    const joinDate = dayjs(new Date(dto.joinDate));

    if (joinDate.isAfter(dayjs(), 'day')) {
      throw new BadRequestException('Join date cannot be in the future');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ userName: dto.userName }, { email: dto.email }] },
    });

    if (existing) {
      throw new ConflictException(
        existing.userName === dto.userName
          ? 'Username is already taken'
          : 'Email is already registered',
      );
    }

    const employee = await this.prisma.employee.create({
      data: {
        fullName: dto.fullName,
        bio: dto.bio || null,
        salary: dto.salary,
        skills: dto.skills,
        employmentType: dto.employmentType,
        joinDate: joinDate.toDate(),
        isRemote: dto.isRemote ?? false,
        teamInfo: { connect: { id: team.id } },
        userInfo: {
          create: {
            userName: dto.userName,
            email: dto.email,
            passwordHash: await argon2.hash(dto.password),
            roleInfo: { connect: { name: ROLE.USER } },
          },
        },
      },
      include: { userInfo: true, teamInfo: true },
    });

    return {
      status: HttpStatus.CREATED,
      message: 'Employee created successfully',
      data: employee,
    };
  }

  async updateEmployee(uid: string, dto: UpdateEmployeeDto): Promise<Result> {
    const existing = await this.prisma.employee.findUnique({
      where: { uid },
    });

    if (!existing) {
      throw new NotFoundException('Employee not found');
    }

    const team = dto.teamUid ? await this.findTeam(dto.teamUid) : undefined;
    const joinDate = dto.joinDate ? dayjs(new Date(dto.joinDate)) : undefined;

    if (joinDate?.isAfter(dayjs(), 'day')) {
      throw new BadRequestException('Join date cannot be in the future');
    }

    const employee = await this.prisma.employee.update({
      where: { id: existing.id },
      data: {
        fullName: dto.fullName,
        bio: dto.bio === undefined ? undefined : dto.bio || null,
        salary: dto.salary,
        skills: dto.skills,
        employmentType: dto.employmentType,
        joinDate: joinDate?.toDate(),
        isRemote: dto.isRemote,
        teamId: team?.id,
      },
      include: { userInfo: true, teamInfo: true },
    });

    return {
      status: HttpStatus.OK,
      message: 'Employee updated successfully',
      data: employee,
    };
  }

  async deleteEmployee(uid: string, authUser: AuthUser): Promise<Result> {
    // 1. finding the employee: a super admin can't delete their own account
    const employee = await this.prisma.employee.findUnique({
      where: { uid },
      include: { userInfo: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (employee.userInfo.uid === authUser.uid) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // 2. deleting the login, which removes the profile with it
    await this.prisma.user.delete({ where: { id: employee.userId } });

    // 3. logging the user out everywhere
    await this.tokenService.revokeAll(employee.userInfo.uid);

    return { status: HttpStatus.OK, message: 'Employee deleted successfully' };
  }

  private async findTeam(uid: string) {
    const team = await this.prisma.team.findUnique({ where: { uid } });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }
}
