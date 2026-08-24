import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'فودافون مصر - حساب الشركات 25' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'S 25' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: '#E60000' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number = 1;

  @ApiPropertyOptional({ example: '2026-08-25' })
  @IsOptional()
  @IsString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 'أحمد الصاوي' })
  @IsOptional()
  @IsString()
  sponsorName?: string;

  @ApiPropertyOptional({ example: '01011122233' })
  @IsOptional()
  @IsString()
  sponsorPhone?: string;

  @ApiPropertyOptional({ example: 'محمد محمود' })
  @IsOptional()
  @IsString()
  accountManagerName?: string;

  @ApiPropertyOptional({ example: '01099988877' })
  @IsOptional()
  @IsString()
  accountManagerPhone?: string;

  @ApiPropertyOptional({ example: 'AUTH-2025-9988' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ example: 'ملاحظات وتفاصيل التعاقد' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string = 'ACTIVE';
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'فودافون مصر - حساب الشركات 25' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'S 25' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: '#E60000' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @ApiPropertyOptional({ example: '2026-08-25' })
  @IsOptional()
  @IsString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 'أحمد الصاوي' })
  @IsOptional()
  @IsString()
  sponsorName?: string;

  @ApiPropertyOptional({ example: '01011122233' })
  @IsOptional()
  @IsString()
  sponsorPhone?: string;

  @ApiPropertyOptional({ example: 'محمد محمود' })
  @IsOptional()
  @IsString()
  accountManagerName?: string;

  @ApiPropertyOptional({ example: '01099988877' })
  @IsOptional()
  @IsString()
  accountManagerPhone?: string;

  @ApiPropertyOptional({ example: 'AUTH-2025-9988' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiPropertyOptional({ example: 'ملاحظات وتفاصيل التعاقد' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
}
