import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateMonthlyChargeDto {
  @ApiProperty({ example: 'uuid-line-id' })
  @IsNotEmpty()
  @IsString()
  lineId: string;

  @ApiProperty({ example: '2026-08', description: 'Billing period format YYYY-MM' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'Billing month must be formatted as YYYY-MM' })
  billingMonth: string;

  @ApiProperty({ example: '2026-08-15', description: 'Due date' })
  @IsNotEmpty()
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: 100, description: 'Obligation amount in whole EGP' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Monthly package fee' })
  @IsOptional()
  @IsString()
  notes?: string;
}
