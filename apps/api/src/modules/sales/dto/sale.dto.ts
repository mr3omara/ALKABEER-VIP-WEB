import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@alkabeer/shared';

export class CreateSaleItemDto {
  @ApiProperty({ example: 'uuid-line-id' })
  @IsNotEmpty()
  @IsString()
  lineId: string;

  @ApiProperty({ example: 150, description: 'Line sale price in whole EGP' })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0, description: 'Discount for this item in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number = 0;

  @ApiPropertyOptional({ example: 'SIM Activation package' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateSaleDto {
  @ApiProperty({ example: 'uuid-customer-id' })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @ApiPropertyOptional({ example: 0, description: 'Overall sale discount in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number = 0;

  @ApiPropertyOptional({ example: 150, description: 'Immediate upfront payment in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  paid?: number = 0;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({ example: 'uuid-treasury-account-id', description: 'Treasury account if paid > 0' })
  @IsOptional()
  @IsString()
  treasuryAccountId?: string;

  @ApiPropertyOptional({ example: 'Sale notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
