import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportEngineService, ImportExecutionResult } from './import-engine.service';

export interface SqliteExportRow {
  customerCode: string;
  companyCode: string;
  phoneNumber: string;
  customerName: string;
  monthlyPackage: number;
  packageName: string;
  activationDate?: string;
  renewalDate?: string;
  notes?: string;
  fullName?: string;
  nationalId?: string;
  openingBalance?: number;
}

@Injectable()
export class SqliteMigrationService {
  private readonly logger = new Logger(SqliteMigrationService.name);

  constructor(private readonly importEngine: ImportEngineService) {}

  /**
   * Transforms raw records from Desktop SQLite schema into Master Excel Workbook Buffer
   */
  createMasterBufferFromSqliteRows(rows: SqliteExportRow[]): Buffer {
    if (!rows || rows.length === 0) {
      throw new BadRequestException('لا توجد سجلات من قاعدة بيانات الديسكتوب لتحويلها');
    }

    const mainHeader = [
      'كود العميل',
      'الشركة',
      'رقم الخط',
      'اسم العميل',
      'الباقة الشهرية',
      'فلكس',
      'تاريخ التشغيل',
      'تاريخ التجديد',
      'ملاحظات',
      'الاسم بالكامل / الجد',
      'رقم قومي',
    ];

    const mainRows: any[][] = [mainHeader];
    const openingBalancesMap = new Map<string, { name: string; balance: number }>();

    for (const r of rows) {
      mainRows.push([
        r.customerCode,
        r.companyCode,
        r.phoneNumber,
        r.customerName,
        r.monthlyPackage,
        r.packageName,
        r.activationDate || '',
        r.renewalDate || '',
        r.notes || '',
        r.fullName || '',
        r.nationalId || '',
      ]);

      if (r.openingBalance !== undefined) {
        openingBalancesMap.set(r.customerCode, {
          name: r.customerName,
          balance: r.openingBalance,
        });
      }
    }

    const openingHeader = ['كود العميل', 'اسم العميل', 'إجمالي المديونية (افتتاحي)'];
    const openingRows: any[][] = [openingHeader];

    for (const [code, item] of openingBalancesMap) {
      openingRows.push([code, item.name, item.balance]);
    }

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(mainRows);
    const s2 = XLSX.utils.aoa_to_sheet(openingRows);

    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    XLSX.utils.book_append_sheet(wb, s2, 'أرصدة_افتتاحية_الكبير');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Direct migration from Desktop SQLite rows to PostgreSQL through Atomic Import Engine
   */
  async migrateFromSqliteRows(
    rows: SqliteExportRow[],
    userId?: string,
  ): Promise<ImportExecutionResult> {
    const buffer = this.createMasterBufferFromSqliteRows(rows);
    return this.importEngine.executeFullImport(buffer, userId);
  }
}
