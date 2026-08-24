import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { ExcelParserService } from './excel-parser.service';
import { ImportEngineService } from './import-engine.service';
import { ExportEngineService } from './export-engine.service';
import { SqliteMigrationService } from './sqlite-migration.service';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.SESSION_SECRET || 'development_secret_key_32_characters_minimum_len',
    }),
    AuditModule,
  ],
  controllers: [BackupController],
  providers: [
    BackupService,
    ExcelParserService,
    ImportEngineService,
    ExportEngineService,
    SqliteMigrationService,
  ],
  exports: [
    BackupService,
    ExcelParserService,
    ImportEngineService,
    ExportEngineService,
    SqliteMigrationService,
  ],
})
export class BackupModule {}

