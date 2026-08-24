import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { LineStatus } from '@alkabeer/shared';

export class CreateLineDto {
  @ApiProperty({ example: '01099887766' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^01[0125][0-9]{8}$/, { message: 'Phone number must be a valid 11-digit Egyptian mobile number' })
  phoneNumber: string;

  @ApiProperty({ example: 'uuid-company-id' })
  @IsNotEmpty()
  @IsString()
  companyId: string;

  @ApiPropertyOptional({ example: 100, description: 'Monthly package price in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPackage?: number = 0;

  @ApiPropertyOptional({ example: 0, description: 'Additional package price in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalPackage?: number = 0;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDay?: number = 1;

  @ApiPropertyOptional({ example: '2026-08-22', description: 'Renewal date' })
  @IsOptional()
  @IsString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 50, description: 'Purchase cost in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number = 0;

  @ApiPropertyOptional({ example: 150, description: 'Sale price in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  salePrice?: number = 0;

  @ApiPropertyOptional({ example: 'VIP Gold Number' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateBulkLinesDto {
  @ApiProperty({ example: ['01012345678', '01098765432'] })
  @IsArray()
  @IsString({ each: true })
  phoneNumbers: string[];

  @ApiProperty({ example: 'uuid-company-id' })
  @IsNotEmpty()
  @IsString()
  companyId: string;

  @ApiPropertyOptional({ example: 100, description: 'Monthly package price in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPackage?: number = 0;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDay?: number = 1;

  @ApiPropertyOptional({ example: '2026-08-22', description: 'Renewal date' })
  @IsOptional()
  @IsString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 50, description: 'Purchase cost in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number = 0;

  @ApiPropertyOptional({ example: 150, description: 'Sale price in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  salePrice?: number = 0;

  @ApiPropertyOptional({ example: 'ملاحظات الخط' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLineDto {
  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyPackage?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalPackage?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDay?: number;

  @ApiPropertyOptional({ example: '2026-08-22' })
  @IsOptional()
  @IsString()
  renewalDate?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ enum: LineStatus })
  @IsOptional()
  @IsEnum(LineStatus)
  status?: LineStatus;

  @ApiPropertyOptional({ example: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
