import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@alkabeer/shared';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-customer-id' })
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @ApiProperty({ example: 250, description: 'Payment amount in whole EGP (strictly > 0)' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiProperty({ example: 'uuid-treasury-account-id' })
  @IsNotEmpty()
  @IsString()
  treasuryAccountId: string;

  @ApiPropertyOptional({ example: 'Bank Ref #987654' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'Payment for July & August bills' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReversePaymentDto {
  @ApiProperty({ example: 'Customer paid by mistake or double entered' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
