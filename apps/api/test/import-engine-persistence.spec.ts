import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ExcelParserService } from '../src/modules/backup/excel-parser.service';
import { ImportEngineService } from '../src/modules/backup/import-engine.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { ReportsService } from '../src/modules/reports/reports.service';

describe('End-to-End Excel Import Pipeline: Data Persistence & Distribution', () => {
  let prisma: PrismaClient;
  let excelParser: ExcelParserService;
  let importEngine: ImportEngineService;
  let inventoryService: InventoryService;
  let reportsService: ReportsService;

  const mockAuditService: any = {
    record: async () => {},
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    excelParser = new ExcelParserService();
    importEngine = new ImportEngineService(prisma as any, mockAuditService, excelParser);
    inventoryService = new InventoryService(prisma as any, mockAuditService);
    reportsService = new ReportsService(prisma as any);

    // Clean up any test records from prior runs in correct FK dependency order
    const testPhones = ['01099887766', '01099887755', '01188776655', '0453942433'];
    const existingLines = await prisma.line.findMany({
      where: { phoneNumber: { in: testPhones } },
      select: { id: true },
    });
    const lineIds = existingLines.map((l) => l.id);
    if (lineIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({ where: { lineId: { in: lineIds } } });
      await prisma.line.deleteMany({ where: { id: { in: lineIds } } });
    }
    await prisma.customer.deleteMany({
      where: { customerCode: { in: ['E2E-1012', 'E2E-1086', 'E2E-1090'] } },
    });

    const buffer = generateTestWorkbookBuffer();
    await importEngine.executeFullImport(buffer, 'test-user-id');
  });

  afterAll(async () => {
    // Clean up test records
    const testPhones = ['01099887766', '01099887755', '01188776655', '0453942433'];
    const existingLines = await prisma.line.findMany({
      where: { phoneNumber: { in: testPhones } },
      select: { id: true },
    });
    const lineIds = existingLines.map((l) => l.id);
    if (lineIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({ where: { lineId: { in: lineIds } } });
      await prisma.line.deleteMany({ where: { id: { in: lineIds } } });
    }
    await prisma.customer.deleteMany({
      where: { customerCode: { in: ['E2E-1012', 'E2E-1086', 'E2E-1090'] } },
    });
    await prisma.$disconnect();
  });

  const generateTestWorkbookBuffer = (): Buffer => {
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

    const mainRows = [
      mainHeader,
      // Customer 1 (Multi-line): E2E-1012 with 2 lines
      [
        'E2E-1012',
        'VF-VIP',
        '01099887766',
        'عوض بدران عنب',
        130,
        'فودافون بيزنس 130',
        '01/01/2025',
        '20/08/2026',
        'خط رئيسي',
        'عوض بدران محمد عنب',
        '29001011234567',
      ],
      [
        'E2E-1012',
        'VF-VIP',
        '01099887755',
        'عوض بدران عنب',
        130,
        'فودافون بيزنس 130',
        '01/01/2025',
        '20/08/2026',
        'خط إضافي',
        'عوض بدران محمد عنب',
        '29001011234567',
      ],
      // Customer 2 (Single line): E2E-1086 with Opening Balance
      [
        'E2E-1086',
        'ET-VIP',
        '01188776655',
        'محمود سعيد',
        200,
        'اتصالات إمرالد 200',
        '15/02/2025',
        '07/08/2026',
        'عميل VIP',
        'محمود سعيد علي حسن',
        '28505051234567',
      ],
      // Customer 3 (Landline line): E2E-1090
      [
        'E2E-1090',
        'WE-LAND',
        '453942433', // Landline without 0 -> normalized to 0453942433
        'شركة الأمل للتجارة',
        350,
        'وي أرضي بيزنس 350',
        '10/03/2025',
        '15/08/2026',
        'خط أرضي فرع دمنهور',
        'شركة الأمل للتجارة والاستيراد',
        '27003031234567',
      ],
    ];

    const openingHeader = ['كود العميل', 'اسم العميل', 'إجمالي المديونية (افتتاحي)'];
    const openingRows = [
      openingHeader,
      ['E2E-1086', 'محمود سعيد', 4500],
      ['E2E-1012', 'عوض بدران عنب', 0],
      ['E2E-1090', 'شركة الأمل للتجارة', 1800],
    ];

    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.aoa_to_sheet(mainRows);
    const s2 = XLSX.utils.aoa_to_sheet(openingRows);
    XLSX.utils.book_append_sheet(wb, s1, 'تصدير_الكبير');
    XLSX.utils.book_append_sheet(wb, s2, 'أرصدة_افتتاحية_الكبير');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  };

  it('1. Executes real atomic write into database and returns correct execution statistics', async () => {
    const buffer = generateTestWorkbookBuffer();
    const result = await importEngine.executeFullImport(buffer, 'test-user-id');

    expect(result.success).toBe(true);
    expect(result.customersCreated + result.customersUpdated).toBeGreaterThanOrEqual(3);
    expect(result.linesCreated + result.linesUpdated).toBeGreaterThanOrEqual(4);
    expect(result.openingBalancesApplied).toBeGreaterThanOrEqual(2);
  });

  it('2. Multi-Line Customers: E2E-1012 has exactly 1 customer record and 2 lines attached in DB', async () => {
    const customer = await prisma.customer.findUnique({
      where: { customerCode: 'E2E-1012' },
      include: { lines: { include: { company: true } } },
    });

    expect(customer).toBeDefined();
    expect(customer!.name).toBe('عوض بدران عنب');
    expect(customer!.fullName).toBe('عوض بدران محمد عنب');
    expect(customer!.lines.length).toBe(2);

    const phones = customer!.lines.map((l) => l.phoneNumber).sort();
    expect(phones).toEqual(['01099887755', '01099887766']);
    expect(customer!.lines[0].company.code).toBe('VF-VIP');
  });

  it('3. Landline Support & Normalization: E2E-1090 landline 453942433 normalized to 0453942433 and persisted', async () => {
    const line = await prisma.line.findUnique({
      where: { phoneNumber: '0453942433' },
      include: { customer: true, company: true },
    });

    expect(line).toBeDefined();
    expect(line!.customer?.customerCode).toBe('E2E-1090');
    expect(line!.monthlyPackage).toBe(350);
    expect(line!.paymentDay).toBe(15);
  });

  it('4. Opening Balances: E2E-1086 openingBalance is 4500 and included in Debt Reports', async () => {
    const customer = await prisma.customer.findUnique({
      where: { customerCode: 'E2E-1086' },
    });

    expect(customer).toBeDefined();
    expect(customer!.openingBalance).toBe(4500);

    const debtReport = await reportsService.getCustomerDebtReport(customer!.id);
    expect(debtReport.length).toBe(1);
    expect(debtReport[0].openingBalance).toBe(4500);
    expect(debtReport[0].totalDebt).toBeGreaterThanOrEqual(4500);
  });

  it('5. Packages Visibility: InventoryService.getPackages() returns the imported packages', async () => {
    const packagesResponse = await inventoryService.getPackages();
    expect(packagesResponse.items.length).toBeGreaterThanOrEqual(3);

    const vfPkg = packagesResponse.items.find((p) => p.name === 'فودافون بيزنس 130');
    expect(vfPkg).toBeDefined();
    expect(vfPkg!.sellingPrice).toBe(130);
  });
});
