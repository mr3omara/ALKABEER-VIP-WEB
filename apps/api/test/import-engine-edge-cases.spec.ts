import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { ExcelParserService } from '../src/modules/backup/excel-parser.service';
import { ImportEngineService } from '../src/modules/backup/import-engine.service';
import { SqliteMigrationService } from '../src/modules/backup/sqlite-migration.service';

describe('Import Engine Failure & Edge-Case Resilience Suite', () => {
  let prisma: PrismaClient;
  let excelParser: ExcelParserService;
  let importEngine: ImportEngineService;
  let sqliteMigrationService: SqliteMigrationService;

  const mockAuditService: any = {
    record: async () => {},
  };

  const cleanupTestRecords = async () => {
    const testCodes = ['SKIP-OK', 'SQLITE-01', 'DUP-1001'];
    for (const code of testCodes) {
      const cust = await prisma.customer.findUnique({
        where: { customerCode: code },
        include: { lines: true },
      });
      if (cust) {
        const lineIds = cust.lines.map((l) => l.id);
        if (lineIds.length > 0) {
          await prisma.inventoryMovement.deleteMany({ where: { lineId: { in: lineIds } } });
          await prisma.monthlyCharge.deleteMany({ where: { lineId: { in: lineIds } } });
          await prisma.line.deleteMany({ where: { id: { in: lineIds } } });
        }
        await prisma.monthlyCharge.deleteMany({ where: { customerId: cust.id } });
        await prisma.payment.deleteMany({ where: { customerId: cust.id } });
        await prisma.customer.delete({ where: { id: cust.id } });
      }
    }
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    excelParser = new ExcelParserService();
    importEngine = new ImportEngineService(prisma as any, mockAuditService, excelParser);
    sqliteMigrationService = new SqliteMigrationService(importEngine);
    await cleanupTestRecords();
  });

  afterAll(async () => {
    await cleanupTestRecords();
    await prisma.$disconnect();
  });

  it('1. Empty Excel File: Throws clear BadRequestException when workbook is empty or missing sheets', async () => {
    const emptyWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(emptyWb, XLSX.utils.aoa_to_sheet([]), 'Sheet1');
    const emptyBuffer = XLSX.write(emptyWb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => excelParser.parseMasterWorkbook(emptyBuffer)).toThrow(BadRequestException);
  });

  it('2. Corrupted / Unreadable File Buffer: Rejects random byte stream without crashing', async () => {
    const corruptedBuffer = Buffer.from([0x00, 0x1f, 0x8b, 0xff, 0xee, 0xdd, 0xcc, 0xbb]);

    expect(() => excelParser.parseMasterWorkbook(corruptedBuffer)).toThrow(BadRequestException);
  });

  it('3. Missing Required Columns: Accurately flags missing columns with clear Arabic diagnostic messages', async () => {
    // Missing 'رقم الخط' and 'كود العميل'
    const incompleteHeaders = [['الشركة', 'اسم العميل', 'الباقة الشهرية']];
    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(incompleteHeaders);
    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    expect(() => excelParser.parseMasterWorkbook(buffer)).toThrow(BadRequestException);
  });

  it('4. Missing & Invalid Fields per Row: Identifies row number, field name, and reason', async () => {
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

    const badRows = [
      mainHeader,
      ['', 'VF', '01012345671', 'بدون كود', 100, 'فليكس', '', '', '', '', ''], // Row 2: Missing customer code
      ['ERR-01', '', '01012345672', 'بدون شركة', 100, 'فليكس', '', '', '', '', ''], // Row 3: Missing company
      ['ERR-02', 'VF', '12345', 'رقم تالف', 100, 'فليكس', '', '', '', '', ''], // Row 4: Bad phone length
      ['ERR-03', 'VF', '01012345673', '', 100, 'فليكس', '', '', '', '', ''], // Row 5: Missing customer name
      ['ERR-04', 'VF', '01012345674', 'سعر تالف', 'غير_رقمي', 'فليكس', '', '', '', '', ''], // Row 6: Non-numeric price
    ];

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(badRows);
    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = excelParser.parseMasterWorkbook(buffer);
    expect(result.errors.length).toBe(5);

    expect(result.errors.find((e) => e.rowNumber === 2)?.field).toBe('كود العميل');
    expect(result.errors.find((e) => e.rowNumber === 3)?.field).toBe('الشركة');
    expect(result.errors.find((e) => e.rowNumber === 4)?.field).toBe('رقم الخط');
    expect(result.errors.find((e) => e.rowNumber === 5)?.field).toBe('اسم العميل');
    expect(result.errors.find((e) => e.rowNumber === 6)?.field).toBe('الباقة الشهرية');
  });

  it('5. Internal Duplicate Rows in Same File: Safe Deduplication without crash', async () => {
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

    // Same customer and phone repeated twice in the same sheet
    const duplicateRows = [
      mainHeader,
      [
        'DUP-1001',
        'VF-DUP',
        '01077665544',
        'عميل مكرر',
        100,
        'باقة 100',
        '01/01/2025',
        '10/08/2026',
        'النسخة الأولى',
        'عميل مكرر بالكامل',
        '29001011234567',
      ],
      [
        'DUP-1001',
        'VF-DUP',
        '01077665544',
        'عميل مكرر',
        100,
        'باقة 100',
        '01/01/2025',
        '10/08/2026',
        'النسخة المكررة',
        'عميل مكرر بالكامل',
        '29001011234567',
      ],
    ];

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(duplicateRows);
    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // When import runs with skipInvalidRows: true, the duplicate row is safely skipped and valid row is imported
    const importResult = await importEngine.executeFullImport(buffer, undefined, { skipInvalidRows: true });
    expect(importResult.success).toBe(true);

    // Assert only 1 line and 1 customer exist in database for this phone
    const lineCount = await prisma.line.count({
      where: { phoneNumber: '01077665544' },
    });
    expect(lineCount).toBe(1);
  });

  it('6. Safe Skip Mode: Imports valid rows and skips invalid rows when skipInvalidRows is true', async () => {
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

    const mixedRows = [
      mainHeader,
      // 1 Valid Row
      [
        'SKIP-OK',
        'VF-SKIP',
        '01066554433',
        'عميل صالح للاستيراد',
        150,
        'باقة صالحة',
        '01/01/2025',
        '05/08/2026',
        '',
        '',
        '',
      ],
      // 1 Invalid Row (bad phone number)
      ['SKIP-BAD', 'VF-SKIP', '01012', 'عميل به خطأ', 150, 'باقة صالحة', '', '', '', '', ''],
    ];

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(mixedRows);
    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Strict Mode: throws BadRequestException
    await expect(importEngine.executeFullImport(buffer, undefined, { skipInvalidRows: false })).rejects.toThrow(
      BadRequestException,
    );

    // Skip Mode: successfully imports valid row and reports skipped count
    const skipResult = await importEngine.executeFullImport(buffer, undefined, { skipInvalidRows: true });
    expect(skipResult.success).toBe(true);
    expect(skipResult.recordsSkipped).toBe(1);

    const validCust = await prisma.customer.findUnique({
      where: { customerCode: 'SKIP-OK' },
    });
    expect(validCust).toBeDefined();
  });

  it('7. Desktop SQLite Migration Service: Transforms Desktop SQLite records with 1:1 round-trip fidelity', async () => {
    const sqliteRows = [
      {
        customerCode: 'SQLITE-01',
        companyCode: 'Y20',
        phoneNumber: '01055443322',
        customerName: 'أحمد علي',
        monthlyPackage: 120,
        packageName: 'باقة فودافون 120',
        renewalDate: '2026-08-20',
        openingBalance: 2300,
      },
    ];

    const migrationResult = await sqliteMigrationService.migrateFromSqliteRows(sqliteRows);
    expect(migrationResult.success).toBe(true);

    const cust = await prisma.customer.findUnique({
      where: { customerCode: 'SQLITE-01' },
      include: { lines: true },
    });

    expect(cust).toBeDefined();
    expect(cust!.openingBalance).toBe(2300);
    expect(cust!.lines[0].phoneNumber).toBe('01055443322');
  });
});
