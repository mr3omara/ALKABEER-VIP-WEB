import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { getConfiguration } from './config/configuration';
import { PrismaModule } from './database/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { LinesModule } from './modules/lines/lines.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MonthlyChargesModule } from './modules/monthly-charges/monthly-charges.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { DailyClosingModule } from './modules/daily-closing/daily-closing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { BackupModule } from './modules/backup/backup.module';
import { LedgerModule } from './modules/ledger/ledger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [getConfiguration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RbacModule,
    CustomersModule,
    CompaniesModule,
    LinesModule,
    InventoryModule,
    SalesModule,
    PaymentsModule,
    MonthlyChargesModule,
    TreasuryModule,
    ExpensesModule,
    DailyClosingModule,
    ReportsModule,
    SettingsModule,
    BackupModule,
    LedgerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
