import { Module } from '@nestjs/common';
import { MonthlyChargesService } from './monthly-charges.service';
import { MonthlyChargesController } from './monthly-charges.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SESSION_SECRET || 'development_secret_key_32_characters_minimum_len',
    }),
  ],
  controllers: [MonthlyChargesController],
  providers: [MonthlyChargesService],
  exports: [MonthlyChargesService],
})
export class MonthlyChargesModule {}
