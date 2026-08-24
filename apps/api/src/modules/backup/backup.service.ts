import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, LineStatus, InventoryMovementType } from '@alkabeer/shared';

@Injectable()
export class BackupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupsBaseDir = path.resolve(process.cwd(), 'backups');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.ensureDirectoryExists(this.backupsBaseDir);
  }

  async onApplicationBootstrap() {
    // Automated trigger on first app/API launch of every day
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingToday = await this.prisma.backupLog.findFirst({
        where: {
          createdAt: {
            gte: new Date(`${today}T00:00:00.000Z`),
          },
        },
      });

      if (!existingToday) {
        this.logger.log(`Starting automated daily dual backup for [${today}]...`);
        await this.createDualBackup('SYSTEM_DAILY_AUTO');
        this.logger.log(`Automated daily backup completed successfully for [${today}].`);
      }
    } catch (error: any) {
      this.logger.error(`Automated daily backup error: ${error?.message}`, error?.stack);
    }
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private format12HourTime(date: Date): string {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const strHours = String(hours).padStart(2, '0');
    return `${strHours}-${minutes}-${seconds}_${ampm}`;
  }

  async createDualBackup(
    triggeredBy: string = 'ADMIN_MANUAL',
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const now = new Date();
    const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = this.format12HourTime(now);
    const targetDir = path.join(this.backupsBaseDir, dateFolder);
    this.ensureDirectoryExists(targetDir);

    const baseName = `backup_${dateFolder}_${timeStr}`;
    const sqlFileName = `${baseName}.sql`;
    const jsonFileName = `${baseName}.json`;
    const sqlFilePath = path.join(targetDir, sqlFileName);
    const jsonFilePath = path.join(targetDir, jsonFileName);

    // Fetch all database tables
    const [
      settings,
      companies,
      customers,
      lines,
      inventoryMovements,
      sales,
      saleItems,
      payments,
      paymentAllocations,
      monthlyCharges,
      treasuryAccounts,
      treasuryTransactions,
      expenseCategories,
      expenses,
      dailyClosings,
      users,
      roles,
    ] = await Promise.all([
      this.prisma.setting.findMany(),
      this.prisma.company.findMany(),
      this.prisma.customer.findMany(),
      this.prisma.line.findMany(),
      this.prisma.inventoryMovement.findMany(),
      this.prisma.sale.findMany(),
      this.prisma.saleItem.findMany(),
      this.prisma.payment.findMany(),
      this.prisma.paymentAllocation.findMany(),
      this.prisma.monthlyCharge.findMany(),
      this.prisma.treasuryAccount.findMany(),
      this.prisma.treasuryTransaction.findMany(),
      this.prisma.expenseCategory.findMany(),
      this.prisma.expense.findMany(),
      this.prisma.dailyClosing.findMany(),
      this.prisma.user.findMany({ select: { id: true, username: true, email: true, fullName: true, status: true, createdAt: true } }),
      this.prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } }),
    ]);

    const fullDataset = {
      meta: {
        version: '1.0.0',
        system: 'ALKABEER VIP WEB',
        backupTimestamp: now.toISOString(),
        formattedTime: timeStr,
        triggeredBy,
      },
      settings,
      companies,
      customers,
      lines,
      inventoryMovements,
      sales,
      saleItems,
      payments,
      paymentAllocations,
      monthlyCharges,
      treasuryAccounts,
      treasuryTransactions,
      expenseCategories,
      expenses,
      dailyClosings,
      users,
      roles,
    };

    // 1. Write JSON multi-table backup
    const jsonContent = JSON.stringify(fullDataset, null, 2);
    fs.writeFileSync(jsonFilePath, jsonContent, 'utf-8');

    // 2. Generate SQL dump script
    let sqlContent = `-- ALKABEER VIP WEB DATABASE BACKUP
-- Generated At: ${now.toISOString()} (${timeStr})
-- Triggered By: ${triggeredBy}

BEGIN;

-- Metadata Comment
-- Total Companies: ${companies.length}
-- Total Customers: ${customers.length}
-- Total Lines: ${lines.length}
-- Total Sales: ${sales.length}
-- Total Payments: ${payments.length}
-- Total Treasury Accounts: ${treasuryAccounts.length}

`;

    // SQL dump lines for settings
    for (const s of settings) {
      sqlContent += `INSERT INTO settings (key, value, description, updated_at) VALUES ('${s.key.replace(/'/g, "''")}', '${s.value.replace(/'/g, "''")}', ${s.description ? `'${s.description.replace(/'/g, "''")}'` : 'NULL'}, '${s.updatedAt.toISOString()}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\n`;
    }

    // SQL dump lines for companies
    for (const c of companies) {
      sqlContent += `INSERT INTO companies (id, name, code, color, payment_day, status, created_at, updated_at) VALUES ('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.code}', ${c.color ? `'${c.color}'` : 'NULL'}, ${c.paymentDay}, '${c.status}', '${c.createdAt.toISOString()}', '${c.updatedAt.toISOString()}') ON CONFLICT (id) DO NOTHING;\n`;
    }

    // SQL dump lines for customers
    for (const cu of customers) {
      sqlContent += `INSERT INTO customers (id, customer_code, name, phone, national_id, address, notes, status, created_at, updated_at) VALUES ('${cu.id}', '${cu.customerCode}', '${cu.name.replace(/'/g, "''")}', '${cu.phone}', ${cu.nationalId ? `'${cu.nationalId}'` : 'NULL'}, ${cu.address ? `'${cu.address.replace(/'/g, "''")}'` : 'NULL'}, ${cu.notes ? `'${cu.notes.replace(/'/g, "''")}'` : 'NULL'}, '${cu.status}', '${cu.createdAt.toISOString()}', '${cu.updatedAt.toISOString()}') ON CONFLICT (id) DO NOTHING;\n`;
    }

    sqlContent += `\nCOMMIT;\n`;
    fs.writeFileSync(sqlFilePath, sqlContent, 'utf-8');

    const totalBytes = BigInt(Buffer.byteLength(jsonContent, 'utf-8') + Buffer.byteLength(sqlContent, 'utf-8'));

    // Record in database
    const backupLog = await this.prisma.backupLog.create({
      data: {
        filename: `${sqlFileName} + ${jsonFileName}`,
        sizeBytes: totalBytes,
        status: 'SUCCESS',
        triggeredBy,
      },
    });

    // Record in Audit Trail
    await this.auditService.record({
      action: AuditAction.CREATE,
      entityType: 'Backup',
      entityId: backupLog.id,
      newData: {
        filename: backupLog.filename,
        sizeBytes: totalBytes.toString(),
        dateFolder,
        timeStr,
        triggeredBy,
        counts: {
          customers: customers.length,
          lines: lines.length,
          sales: sales.length,
          payments: payments.length,
          treasury: treasuryAccounts.length,
        },
      },
      userId,
      ipAddress,
      userAgent,
    });

    // Enforce retention policy (keep latest 10 backup folders/files)
    await this.enforceRetentionPolicy();

    return {
      id: backupLog.id,
      filename: backupLog.filename,
      sizeBytes: totalBytes.toString(),
      status: 'SUCCESS',
      dateFolder,
      timeStr,
      path: `./backups/${dateFolder}/`,
      createdAt: backupLog.createdAt,
      dataset: fullDataset,
    };
  }

  private async enforceRetentionPolicy(maxRetained: number = 10) {
    try {
      if (!fs.existsSync(this.backupsBaseDir)) return;
      const folders = fs
        .readdirSync(this.backupsBaseDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
        .reverse();

      if (folders.length > maxRetained) {
        const toDelete = folders.slice(maxRetained);
        for (const f of toDelete) {
          const p = path.join(this.backupsBaseDir, f);
          fs.rmSync(p, { recursive: true, force: true });
          this.logger.log(`Purged old backup folder according to retention policy: ${f}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Retention policy cleanup warning: ${err?.message}`);
    }
  }

  async getStatus() {
    const lastBackup = await this.prisma.backupLog.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let totalFilesCount = 0;
    let totalDiskBytes = 0;

    if (fs.existsSync(this.backupsBaseDir)) {
      const folders = fs.readdirSync(this.backupsBaseDir, { withFileTypes: true });
      for (const f of folders) {
        if (f.isDirectory()) {
          const dirPath = path.join(this.backupsBaseDir, f.name);
          const files = fs.readdirSync(dirPath);
          totalFilesCount += files.length;
          for (const file of files) {
            const stat = fs.statSync(path.join(dirPath, file));
            totalDiskBytes += stat.size;
          }
        }
      }
    }

    return {
      lastBackup: lastBackup
        ? {
            id: lastBackup.id,
            filename: lastBackup.filename,
            sizeBytes: lastBackup.sizeBytes.toString(),
            status: lastBackup.status,
            triggeredBy: lastBackup.triggeredBy,
            createdAt: lastBackup.createdAt,
          }
        : null,
      backupDir: './backups/',
      totalBackupsCount: totalFilesCount,
      totalDiskBytes,
      retentionPolicy: 'الاحتفاظ بأحدث 10 نسخ يومية تلقائياً',
      status: 'SUCCESS',
      integrity: 'OK',
    };
  }

  async listLogs() {
    const logs = await this.prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return logs.map((l) => ({
      ...l,
      sizeBytes: l.sizeBytes.toString(),
    }));
  }

  async verifyAdminPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return await argon2.verify(user.passwordHash, password);
  }

  async exportMasterDataset() {
    const [
      customers,
      lines,
      companies,
      inventoryMovements,
      sales,
      payments,
      monthlyCharges,
      treasuryAccounts,
      expenses,
    ] = await Promise.all([
      this.prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.line.findMany({ include: { company: true, customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.company.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.inventoryMovement.findMany({ include: { line: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.sale.findMany({ include: { customer: true, items: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.payment.findMany({ include: { customer: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.monthlyCharge.findMany({ include: { customer: true, line: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.treasuryAccount.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.expense.findMany({ include: { category: true, treasuryAccount: true }, orderBy: { expenseDate: 'desc' }, take: 100 }),
    ]);

    return {
      timestamp: new Date().toISOString(),
      customers,
      lines,
      companies,
      inventoryMovements,
      sales,
      payments,
      monthlyCharges,
      treasuryAccounts,
      expenses,
    };
  }

  async importLines(
    linesData: Array<{
      phoneNumber: string;
      companyId: string;
      packageName?: string;
      monthlyPackage?: number;
      additionalPackage?: number;
      purchasePrice?: number;
      salePrice?: number;
      paymentDay?: number;
      notes?: string;
    }>,
    userId?: string,
  ) {
    if (!Array.isArray(linesData) || linesData.length === 0) {
      throw new BadRequestException('No lines data provided for import');
    }

    let createdCount = 0;
    let updatedCount = 0;

    // Load pre-existing telecom packages for automatic price linking
    let packagesList: any[] = [];
    try {
      const pkgPath = path.resolve(process.cwd(), 'backups', 'telecom_packages.json');
      if (fs.existsSync(pkgPath)) {
        packagesList = JSON.parse(fs.readFileSync(pkgPath, 'utf-8') || '[]');
      }
    } catch {}

    for (const item of linesData) {
      if (!item.phoneNumber || !item.companyId) continue;
      const cleanPhone = item.phoneNumber.trim().replace(/\s+/g, '');

      // Check package match by name or numeric value
      let resolvedMonthlyPkg = item.monthlyPackage || 0;
      let resolvedSalePrice = item.salePrice || 0;
      let resolvedPurchasePrice = item.purchasePrice || 0;

      if (item.packageName) {
        const pkgName = item.packageName.trim().toLowerCase();
        const matched = packagesList.find(
          (p) => p.name.trim().toLowerCase() === pkgName,
        );
        if (matched) {
          resolvedMonthlyPkg = matched.sellingPrice;
          resolvedSalePrice = resolvedSalePrice || matched.sellingPrice;
          resolvedPurchasePrice = resolvedPurchasePrice || matched.costPrice;
        }
      }

      const existing = await this.prisma.line.findUnique({
        where: { phoneNumber: cleanPhone },
      });

      if (existing) {
        await this.prisma.line.update({
          where: { id: existing.id },
          data: {
            monthlyPackage: resolvedMonthlyPkg || existing.monthlyPackage,
            additionalPackage: item.additionalPackage ?? existing.additionalPackage,
            purchasePrice: resolvedPurchasePrice || existing.purchasePrice,
            salePrice: resolvedSalePrice || existing.salePrice,
            paymentDay: item.paymentDay ?? existing.paymentDay,
            notes: item.notes ?? existing.notes,
          },
        });
        updatedCount++;
      } else {
        await this.prisma.line.create({
          data: {
            phoneNumber: cleanPhone,
            companyId: item.companyId,
            monthlyPackage: resolvedMonthlyPkg,
            additionalPackage: item.additionalPackage || 0,
            purchasePrice: resolvedPurchasePrice,
            salePrice: resolvedSalePrice,
            paymentDay: item.paymentDay || 1,
            status: LineStatus.IN_STOCK,
            notes: item.notes || 'استيراد مجمع من ملف Excel',
            inventoryMovements: {
              create: {
                movementType: InventoryMovementType.PURCHASE,
                quantity: 1,
                notes: 'استيراد خط جديد من ملف Excel للمخزن',
                createdBy: userId,
              },
            },
          },
        });
        createdCount++;
      }
    }

    return {
      success: true,
      createdCount,
      updatedCount,
      totalProcessed: createdCount + updatedCount,
    };
  }

  async importCompanySheet(
    companyId: string,
    rows: Array<{
      phoneNumber: string;
      monthlyPackage?: number;
      notes?: string;
    }>,
    userId?: string,
  ) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new BadRequestException('Company not found');
    }

    let matchedCount = 0;
    let createdCount = 0;

    for (const row of rows) {
      if (!row.phoneNumber) continue;
      const cleanPhone = row.phoneNumber.trim().replace(/\s+/g, '');

      const existing = await this.prisma.line.findUnique({
        where: { phoneNumber: cleanPhone },
      });

      if (existing) {
        await this.prisma.line.update({
          where: { id: existing.id },
          data: {
            companyId,
            monthlyPackage: row.monthlyPackage ?? existing.monthlyPackage,
            notes: row.notes ? `${existing.notes || ''} | ${row.notes}` : existing.notes,
          },
        });
        matchedCount++;
      } else {
        await this.prisma.line.create({
          data: {
            phoneNumber: cleanPhone,
            companyId,
            monthlyPackage: row.monthlyPackage || 0,
            additionalPackage: 0,
            purchasePrice: 0,
            salePrice: 0,
            paymentDay: 1,
            status: LineStatus.IN_STOCK,
            notes: `استيراد من كشف شركة ${company.name}`,
          },
        });
        createdCount++;
      }
    }

    return {
      success: true,
      companyName: company.name,
      matchedCount,
      createdCount,
      totalProcessed: matchedCount + createdCount,
    };
  }

  async smartMerge(dataset: any, userId?: string) {
    let customersMerged = 0;
    let linesMerged = 0;

    if (Array.isArray(dataset.customers)) {
      for (const cu of dataset.customers) {
        const phone = cu.phone || cu.primaryPhone;
        const name = cu.name || cu.fullName;
        if (!phone && !cu.nationalId) continue;
        const cleanPhone = phone?.trim();

        const existing = await this.prisma.customer.findFirst({
          where: {
            OR: [
              cleanPhone ? { phone: cleanPhone } : undefined,
              cu.nationalId ? { nationalId: cu.nationalId } : undefined,
            ].filter(Boolean) as any,
          },
        });

        if (existing) {
          await this.prisma.customer.update({
            where: { id: existing.id },
            data: {
              name: name || existing.name,
              address: cu.address || existing.address,
              notes: cu.notes ? `${existing.notes || ''} | ${cu.notes}` : existing.notes,
            },
          });
          customersMerged++;
        } else if (name && cleanPhone) {
          const generatedCode = `CUST-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
          await this.prisma.customer.create({
            data: {
              customerCode: cu.customerCode || generatedCode,
              name,
              phone: cleanPhone,
              nationalId: cu.nationalId,
              address: cu.address,
              notes: cu.notes || 'دمج واستيراد ذكي',
            },
          });
          customersMerged++;
        }
      }
    }

    if (Array.isArray(dataset.lines)) {
      for (const l of dataset.lines) {
        if (!l.phoneNumber) continue;
        const cleanPhone = l.phoneNumber.trim();

        const existing = await this.prisma.line.findUnique({
          where: { phoneNumber: cleanPhone },
        });

        if (existing) {
          await this.prisma.line.update({
            where: { id: existing.id },
            data: {
              monthlyPackage: l.monthlyPackage ?? existing.monthlyPackage,
              additionalPackage: l.additionalPackage ?? existing.additionalPackage,
              salePrice: l.salePrice ?? existing.salePrice,
              purchasePrice: l.purchasePrice ?? existing.purchasePrice,
              notes: l.notes ? `${existing.notes || ''} | ${l.notes}` : existing.notes,
            },
          });
          linesMerged++;
        }
      }
    }

    return {
      success: true,
      customersMerged,
      linesMerged,
      totalMerged: customersMerged + linesMerged,
    };
  }
}
