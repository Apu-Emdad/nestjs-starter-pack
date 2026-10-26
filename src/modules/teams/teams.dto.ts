import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { Department } from '../../generated/prisma/enums.js';

export class TeamsQueryDto {
  @ApiPropertyOptional({ enum: Department })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsEnum(Department, {
    message: `Department must be one of: ${Object.values(Department).join(', ')}`,
  })
  department?: Department;
}
