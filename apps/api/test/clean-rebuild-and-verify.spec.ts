import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { ExcelParserService } from '../src/modules/backup/excel-parser.service';
import { ImportEngineService } from '../src/modules/backup/import-engine.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { LinesService } from '../src/modules/lines/lines.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { ReportsService } from '../src/modules/reports/reports.service';

describe('Clean Rebuild & End-to-End Master Data Verification', () => {
  let prisma: PrismaClient;
  let excelParser: ExcelParserService;
  let importEngine: ImportEngineService;
  let customersService: CustomersService;
  let linesService: LinesService;
  let inventoryService: InventoryService;
  let reportsService: ReportsService;

  const MASTER_EXCEL_PATH =
    'G:\\OMARA\\Desktop\\برنامج الكبير اندرويد و exe\\النسخه الاحتياطيه.xlsx';

  const mockAuditService: any = {
    record: async () => {},
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    excelParser = new ExcelParserService();
    importEngine = new ImportEngineService(prisma as any, mockAuditService, excelParser);
    customersService = new CustomersService(prisma as any, mockAuditService);
    linesService = new LinesService(prisma as any, mockAuditService);
    inventoryService = new InventoryService(prisma as any, mockAuditService);
    reportsService = new ReportsService(prisma as any);
  });

  it('1. CLEANUP: Performs clean wipe of all development import records while preserving system configuration', async () => {
    // Clean child tables first to respect foreign key constraints
    await prisma.lineHistory.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    await prisma.monthlyCharge.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.line.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.package.deleteMany({});
    await prisma.company.deleteMany({});
    await prisma.auditLog.deleteMany({ where: { entityType: 'MasterImport' } });

    const cCount = await prisma.customer.count();
    const lCount = await prisma.line.count();
    const compCount = await prisma.company.count();
    const pkgCount = await prisma.package.count();

    expect(cCount).toBe(0);
    expect(lCount).toBe(0);
    expect(compCount).toBe(0);
    expect(pkgCount).toBe(0);
  });

  it('2. MASTER IMPORT: Reads master Excel file and rebuilds entire database in correct dependency order', async () => {
    expect(fs.existsSync(MASTER_EXCEL_PATH)).toBe(true);
    const fileBuffer = fs.readFileSync(MASTER_EXCEL_PATH);
    expect(fileBuffer.length).toBeGreaterThan(0);

    // Get admin user id for valid audit reference if exists
    const adminUser = await prisma.user.findFirst();

    const result = await importEngine.executeFullImport(fileBuffer, adminUser?.id, {
      skipInvalidRows: true,
    });

    expect(result.success).toBe(true);
    expect(result.customersCreated).toBeGreaterThan(0);
    expect(result.linesCreated).toBeGreaterThan(0);
    expect(result.companiesCreated).toBeGreaterThan(0);
    expect(result.packagesCreated).toBeGreaterThan(0);
  });

  it('3. DATABASE VERIFICATION: Verifies live PostgreSQL counts, relationships, and deduplication', async () => {
    const totalCustomers = await prisma.customer.count({ where: { deletedAt: null } });
    const totalLines = await prisma.line.count();
    const totalCompanies = await prisma.company.count();
    const totalPackages = await prisma.package.count();
    const customersWithOpeningDebt = await prisma.customer.count({
      where: { openingBalance: { gt: 0 } },
    });

    console.log('\n--- LIVE DATABASE VERIFICATION ---');
    console.log(`CUSTOMERS: ${totalCustomers}`);
    console.log(`LINES: ${totalLines}`);
    console.log(`COMPANIES: ${totalCompanies}`);
    console.log(`PACKAGES: ${totalPackages}`);
    console.log(`OPENING BALANCES: ${customersWithOpeningDebt}`);

    expect(totalCustomers).toBeGreaterThanOrEqual(100);
    expect(totalLines).toBeGreaterThanOrEqual(100);
    expect(totalCompanies).toBeGreaterThanOrEqual(4);
    expect(totalPackages).toBeGreaterThanOrEqual(5);
    expect(customersWithOpeningDebt).toBeGreaterThan(0);

    // Check Foreign Key Integrity: No orphan lines
    const orphanLinesCount = await prisma.line.count({
      where: { companyId: { equals: '' } },
    });
    expect(orphanLinesCount).toBe(0);

    // Check Multi-line Customers: Verify that multi-line customers exist
    const multiLineCustomers = await prisma.customer.findMany({
      include: { _count: { select: { lines: true } } },
      where: { lines: { some: {} } },
    });
    const hasMultiple = multiLineCustomers.some((c) => c._count.lines > 1);
    expect(hasMultiple).toBe(true);

    // Check Deduplication: Verify unique customer codes and unique line phone numbers
    const allCustomerCodes = await prisma.customer.findMany({ select: { customerCode: true } });
    const uniqueCustomerCodes = new Set(allCustomerCodes.map((c) => c.customerCode));
    expect(allCustomerCodes.length).toBe(uniqueCustomerCodes.size);

    const allPhoneNumbers = await prisma.line.findMany({ select: { phoneNumber: true } });
    const uniquePhoneNumbers = new Set(allPhoneNumbers.map((l) => l.phoneNumber));
    expect(allPhoneNumbers.length).toBe(uniquePhoneNumbers.size);

    // Check Package Deduplication in PostgreSQL
    const allDbPackages = await prisma.package.findMany();
    const dbPkgKeys = allDbPackages.map((p) => `${p.name.trim().toLowerCase()}__${p.sellingPrice}`);
    const uniqueDbPkgKeys = new Set(dbPkgKeys);
    expect(allDbPackages.length).toBe(uniqueDbPkgKeys.size);

    // Verify cleanupPackageDuplicates returns 0 removed
    const cleanupResult = await inventoryService.cleanupPackageDuplicates();
    expect(cleanupResult.removedCount).toBe(0);
    expect(cleanupResult.remainingCount).toBe(allDbPackages.length);
  });

  it('4. API VERIFIED: Validates that all page endpoints return populated data directly from DB', async () => {
    // 1. Customers API
    const customersResponse = await customersService.findMany({ page: 1, limit: 15 });
    expect(customersResponse.items.length).toBeGreaterThan(0);
    expect(customersResponse.meta.totalItems).toBeGreaterThan(0);

    // 2. Lines API (with Inventory KPI summary)
    const linesResponse = await linesService.findMany({ page: 1, limit: 15 });
    expect(linesResponse.items.length).toBeGreaterThan(0);
    expect(linesResponse.summary.totalLines).toBeGreaterThan(0);
    expect(linesResponse.meta.totalItems).toBeGreaterThan(0);

    // 3. Companies API
    const companies = await prisma.company.findMany({
      include: { _count: { select: { lines: true } } },
    });
    expect(companies.length).toBeGreaterThan(0);
    expect(companies.some((c) => (c._count?.lines || 0) > 0)).toBe(true);

    // 4. Packages API (Zero duplicates check)
    const packagesResponse = await inventoryService.getPackages();
    expect(packagesResponse.items.length).toBeGreaterThan(0);
    const pkgKeys = packagesResponse.items.map((p) => `${p.name.trim().toLowerCase()}__${p.sellingPrice}`);
    const uniquePkgKeys = new Set(pkgKeys);
    expect(pkgKeys.length).toBe(uniquePkgKeys.size);

    // 5. Reports API (Customer Debts)
    const customerDebts = await reportsService.getCustomerDebtReport();
    expect(customerDebts.length).toBeGreaterThan(0);

    // 6. Filter & Search Resilience: Empty status and empty string search should not return empty results
    const customersWithEmptyStatus = await customersService.findMany({ page: 1, limit: 15, search: '' }, '' as any);
    expect(customersWithEmptyStatus.items.length).toBeGreaterThan(0);
    expect(customersWithEmptyStatus.meta.totalItems).toBe(239);

    const linesWithEmptyStatus = await linesService.findMany({ page: 1, limit: 15, search: '' }, '', '' as any);
    expect(linesWithEmptyStatus.items.length).toBeGreaterThan(0);
    expect(linesWithEmptyStatus.summary.totalLines).toBe(508);

    // 8. Dashboard Summary API: Authoritative Real Database Verification
    const dashboardSummary = await reportsService.getDashboardSummary();
    expect(dashboardSummary.totalCustomersCount).toBe(239);
    expect(dashboardSummary.totalLinesCount).toBe(508);
    expect(dashboardSummary.totalCompaniesCount).toBe(5);
    expect(dashboardSummary.totalPackagesCount).toBe(67);
    expect(dashboardSummary.totalOutstandingDebt).toBe(52492);
    expect(dashboardSummary.debtorsCount).toBe(123);

    // 9. Renewal Date Full Preservation Architecture Test:
    const linesWithRenewalDate = await prisma.line.findMany({
      where: { renewalDate: { not: null } },
    });
    expect(linesWithRenewalDate.length).toBeGreaterThan(0);
    for (const l of linesWithRenewalDate.slice(0, 10)) {
      expect(l.renewalDate).toBeInstanceOf(Date);
      expect(l.paymentDay).toBe(l.renewalDate!.getDate());
    }
  });
});
