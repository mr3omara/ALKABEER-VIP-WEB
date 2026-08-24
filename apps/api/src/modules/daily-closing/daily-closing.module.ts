import { Module } from '@nestjs/common';
import { DailyClosingService } from './daily-closing.service';
import { DailyClosingController } from './daily-closing.controller';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SESSION_SECRET || 'development_secret_key_32_characters_minimum_len',
    }),
  ],
  controllers: [DailyClosingController],
  providers: [DailyClosingService],
  exports: [DailyClosingService],
})
export class DailyClosingModule {}
