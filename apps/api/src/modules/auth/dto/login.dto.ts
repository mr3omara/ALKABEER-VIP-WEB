import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '009', description: 'Username or Email address' })
  @IsNotEmpty({ message: 'Username or Email is required' })
  @IsString()
  username: string;

  @ApiProperty({ example: '••••••••', description: 'User account password' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}
