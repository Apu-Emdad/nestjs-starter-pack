import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { toBoolean } from '../../common/utils/to-boolean.util.js';
import { Department, EmploymentType } from '../../generated/prisma/enums.js';
import { RegisterDto } from '../auth/dto/register.dto.js';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/** Fields of the employee profile, shared by create and update. */
export class EmployeeProfileDto {
  @ApiProperty({ example: 'Maya Rodriguez' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Full name must be a string' })
  @MinLength(3, { message: 'Full name must be at least 3 characters' })
  @MaxLength(60, { message: 'Full name must be at most 60 characters' })
  fullName: string;

  @ApiPropertyOptional({ example: 'Builds and maintains the web app.' })
  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  @MaxLength(300, { message: 'Bio must be at most 300 characters' })
  bio?: string;

  @ApiProperty({ example: 4500, description: 'Whole number, per month' })
  @IsInt({ message: 'Salary must be a whole number' })
  @Min(0, { message: 'Salary must be at least 0' })
  @Max(10_000_000, { message: 'Salary must be at most 10,000,000' })
  salary: number;

  @ApiProperty({ description: 'uid of the team, from GET /teams' })
  @IsString({ message: 'Team must be a string' })
  @IsNotEmpty({ message: 'Team is required' })
  teamUid: string;

  @ApiProperty({ example: ['React', 'Node'], maxItems: 10 })
  @IsArray({ message: 'Skills must be a list' })
  @ArrayMaxSize(10, { message: 'Skills can have at most 10 items' })
  @ArrayUnique({ message: 'Skills must not repeat' })
  @IsString({ each: true, message: 'Each skill must be a string' })
  @MaxLength(30, {
    each: true,
    message: 'Each skill must be at most 30 characters',
  })
  skills: string[];

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType, {
    message: `Employment type must be one of: ${Object.values(EmploymentType).join(', ')}`,
  })
  employmentType: EmploymentType;

  @ApiProperty({
    example: '2026-10-26',
    description: 'YYYY-MM-DD, not in the future',
  })
  @IsISO8601(
    { strict: true },
    { message: 'Join date must be a date: YYYY-MM-DD' },
  )
  joinDate: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Remote must be true or false' })
  isRemote?: boolean;
}

/** Creating an employee also creates their login, with the same rules as register. */
export class CreateEmployeeDto extends IntersectionType(
  RegisterDto,
  EmployeeProfileDto,
) {}

export class UpdateEmployeeDto extends PartialType(EmployeeProfileDto) {}

export class EmployeesQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, user name or email' })
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @ApiPropertyOptional({ enum: Department })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(Department, {
    message: `Department must be one of: ${Object.values(Department).join(', ')}`,
  })
  department?: Department;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(EmploymentType, {
    message: `Employment type must be one of: ${Object.values(EmploymentType).join(', ')}`,
  })
  employmentType?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'isRemote must be true or false' })
  isRemote?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be a whole number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page size must be a whole number' })
  @Min(1, { message: 'Page size must be at least 1' })
  @Max(100, { message: 'Page size must be at most 100' })
  pageSize?: number;
}
