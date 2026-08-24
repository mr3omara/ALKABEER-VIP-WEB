import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerStatus } from '@alkabeer/shared';

export class CreateCustomerDto {
  @ApiPropertyOptional({ example: 'KA-1003' })
  @IsOptional()
  @IsString()
  customerCode?: string;

  @ApiPropertyOptional({ example: 'حسن عمارة' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ example: 'حسن علي حسن عمارة' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'حسن علي حسن عمارة' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  contactNumber?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'أحمد إبراهيم' })
  @IsOptional()
  @IsString()
  motherGrandpaName?: string;

  @ApiPropertyOptional({ example: '29001011234567' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ example: '2026-08-22' })
  @IsOptional()
  @IsString()
  joinDate?: string;

  @ApiPropertyOptional({ example: 'Cairo, Nasr City' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'VIP Customer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus = CustomerStatus.ACTIVE;
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'KA-1003' })
  @IsOptional()
  @IsString()
  customerCode?: string;

  @ApiPropertyOptional({ example: 'حسن عمارة' })
  @IsOptional()
  @IsString()
  shortName?: string;

  @ApiPropertyOptional({ example: 'حسن علي حسن عمارة' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'حسن علي حسن عمارة' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  contactNumber?: string;

  @ApiPropertyOptional({ example: '01012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'أحمد إبراهيم' })
  @IsOptional()
  @IsString()
  motherGrandpaName?: string;

  @ApiPropertyOptional({ example: '29001011234567' })
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ example: '2026-08-22' })
  @IsOptional()
  @IsString()
  joinDate?: string;

  @ApiPropertyOptional({ example: 'Cairo, Nasr City' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'VIP Customer' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
