import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class OpenDailyClosingDto {
  @ApiProperty({ example: '2026-08-22', description: 'Business date in format YYYY-MM-DD' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Business date must be formatted as YYYY-MM-DD' })
  businessDate: string;

  @ApiPropertyOptional({ example: 5000, description: 'Opening physical balance in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  openingBalance?: number = 0;

  @ApiPropertyOptional({ example: 'Morning opening shift' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseDailyClosingDto {
  @ApiProperty({ example: 12500, description: 'Actual counted physical cash balance in whole EGP' })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  actualBalance: number;

  @ApiPropertyOptional({ example: 'Evening shift closing notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReopenDailyClosingDto {
  @ApiProperty({ example: 'Manager approved reopening to register late payment' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
