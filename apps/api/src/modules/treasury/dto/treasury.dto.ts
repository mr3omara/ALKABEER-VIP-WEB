import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { TreasuryAccountType } from '@alkabeer/shared';

export class CreateTreasuryAccountDto {
  @ApiProperty({ example: 'الخزينة النقدية الرئيسية' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: TreasuryAccountType, default: TreasuryAccountType.CASH })
  @IsOptional()
  @IsEnum(TreasuryAccountType)
  type?: TreasuryAccountType = TreasuryAccountType.CASH;

  @ApiPropertyOptional({ example: 0, description: 'Opening balance in whole EGP' })
  @IsOptional()
  @IsInt()
  @Min(0)
  openingBalance?: number = 0;
}

export class TransferFundsDto {
  @ApiProperty({ example: 'uuid-source-account-id' })
  @IsNotEmpty()
  @IsString()
  fromAccountId: string;

  @ApiProperty({ example: 'uuid-destination-account-id' })
  @IsNotEmpty()
  @IsString()
  toAccountId: string;

  @ApiProperty({ example: 500, description: 'Transfer amount in whole EGP (> 0)' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ example: 'Daily cash deposit to bank' })
  @IsOptional()
  @IsString()
  description?: string;
}
