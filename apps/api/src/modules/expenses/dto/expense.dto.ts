import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@alkabeer/shared';

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: 'مصاريف ضيافة' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'مشروبات وضيافة العملاء والزوار' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ example: 'uuid-category-id' })
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 350, description: 'Expense amount in whole EGP (> 0)' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'uuid-treasury-account-id' })
  @IsNotEmpty()
  @IsString()
  treasuryAccountId: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiProperty({ example: 'شراء ورق طباعة وحبر للمكتب' })
  @IsNotEmpty()
  @IsString()
  description: string;
}
