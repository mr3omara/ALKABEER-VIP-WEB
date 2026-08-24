import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ExcelParserService } from '../src/modules/backup/excel-parser.service';
import { ExportEngineService } from '../src/modules/backup/export-engine.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';

describe('Customer Identity & Master Data Fidelity', () => {
  const prisma = new PrismaClient();
  const prismaService = new PrismaService();
  const excelParser = new ExcelParserService();
  const exportEngine = new ExportEngineService(prismaService);
  const auditService = new AuditService(prismaService);
  const customersService = new CustomersService(prismaService, auditService);

  it('1. Cleans test-polluted records and verifies authoritative customer codes', async () => {
    // Delete any test remnants inserted by mock tests
    const testCodes = ['SQLITE-01', 'DUP-1001', 'SKIP-OK', 'E2E-1012', 'E2E-1086', 'E2E-1090'];
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
        console.log(`Cleaned test record: ${code}`);
      }
    }

    const count = await prisma.customer.count({ where: { deletedAt: null } });
    console.log('Total authoritative customers in DB after cleanup:', count);
    expect(count).toBe(239);
  });

  it('2. Verifies that all 239 customers strictly retain their authoritative KA-xxxx customerCodes', async () => {
    const customers = await prisma.customer.findMany({
      where: { deletedAt: null },
      select: { customerCode: true, name: true, phone: true },
      orderBy: { customerCode: 'asc' },
    });

    for (const c of customers) {
      expect(c.customerCode).toMatch(/^KA-\d+$/);
    }

    const specificCodes = ['KA-1003', 'KA-1004', 'KA-1008', 'KA-1009', 'KA-1011', 'KA-1012', 'KA-1013', 'KA-1014'];
    for (const code of specificCodes) {
      const found = customers.find((c) => c.customerCode === code);
      expect(found).toBeDefined();
      console.log(`Verified authoritative customer [${code}]: "${found?.name}"`);
    }
  });

  it('3. Verifies multi-line customer integrity (KA-1012 has 1 customer and multiple lines)', async () => {
    const cust = await prisma.customer.findUnique({
      where: { customerCode: 'KA-1012' },
      include: { lines: true },
    });
    expect(cust).toBeDefined();
    expect(cust!.lines.length).toBe(2);
    expect(cust!.lines[0].customerId).toBe(cust!.id);
    expect(cust!.lines[1].customerId).toBe(cust!.id);
    console.log(`Multi-line check passed: KA-1012 "${cust!.name}" owns ${cust!.lines.length} lines:`, cust!.lines.map((l) => l.phoneNumber));
  });

  it('4. CustomersService.findMany returns items and pagination structure correctly', async () => {
    const res = await customersService.findMany({ page: 1, limit: 15, skip: 0 });
    expect(res.items).toBeDefined();
    expect(res.items.length).toBe(15);
    expect(res.meta.totalItems).toBe(239);
    expect(res.meta.totalPages).toBe(16);
    console.log('CustomersService.findMany verified: page 1 returned 15 items, totalItems = 239');
  });

  it('5. Verifies Round-Trip Excel Export retains original KA-xxxx codes (KA-1003, KA-1012)', async () => {
    const exportResult = await exportEngine.exportFullAccount();
    expect(exportResult.buffer).toBeDefined();
    expect(exportResult.buffer.length).toBeGreaterThan(0);

    const parsedExport = excelParser.parseMasterWorkbook(exportResult.buffer);
    expect(parsedExport.customersMap.has('KA-1003')).toBe(true);
    expect(parsedExport.customersMap.has('KA-1012')).toBe(true);
    expect(parsedExport.customersMap.has('SQLITE-01')).toBe(false);

    const cust1003 = parsedExport.customersMap.get('KA-1003');
    expect(cust1003?.customerCode).toBe('KA-1003');
    console.log('Round-Trip Excel Export verified: KA-1003 exported as KA-1003 with', cust1003?.lines.length, 'lines.');
  });
});
