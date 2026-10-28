import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ROLE } from '../../common/constants/roles.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  CreateEmployeeDto,
  EmployeesQueryDto,
  UpdateEmployeeDto,
} from './employees.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiBearerAuth()
@ApiTags('Employees')
@Roles(ROLE.SUPER_ADMIN)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async getEmployees(@Query() query: EmployeesQueryDto, @Res() res: Response) {
    const result = await this.employeesService.getEmployees(query);
    res.status(result.status).json(result);
  }

  @Get(':uid')
  async getEmployee(@Param('uid') uid: string, @Res() res: Response) {
    const result = await this.employeesService.getEmployee(uid);
    res.status(result.status).json(result);
  }

  @Post()
  async createEmployee(@Body() dto: CreateEmployeeDto, @Res() res: Response) {
    const result = await this.employeesService.createEmployee(dto);
    res.status(result.status).json(result);
  }

  @Put(':uid')
  async updateEmployee(
    @Param('uid') uid: string,
    @Body() dto: UpdateEmployeeDto,
    @Res() res: Response,
  ) {
    const result = await this.employeesService.updateEmployee(uid, dto);
    res.status(result.status).json(result);
  }

  @Delete(':uid')
  async deleteEmployee(
    @Param('uid') uid: string,
    @CurrentUser() authUser: AuthUser,
    @Res() res: Response,
  ) {
    const result = await this.employeesService.deleteEmployee(uid, authUser);
    res.status(result.status).json(result);
  }
}
