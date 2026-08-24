import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, IsArray } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'ahmed_sales' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'ahmed@alkabeer.local' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ example: 'StrongP@ssw0rd' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: ['SALES'] })
  @IsOptional()
  @IsArray()
  roles?: string[];
}
