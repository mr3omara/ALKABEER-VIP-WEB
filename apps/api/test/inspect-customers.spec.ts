import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Inspect Customers and Codes in DB', () => {
  const prisma = new PrismaClient();

  it('audits all customer codes currently in PostgreSQL', async () => {
    const totalCustomers = await prisma.customer.count();
    console.log('--- TOTAL CUSTOMERS IN DB:', totalCustomers);

    const sample = await prisma.customer.findMany({
      take: 30,
      select: { id: true, customerCode: true, name: true, phone: true, _count: { select: { lines: true } } },
      orderBy: { customerCode: 'asc' },
    });
    console.log('SAMPLE CUSTOMER CODES:');
    sample.forEach(c => {
      console.log(`[${c.customerCode}] name="${c.name}", phone="${c.phone}", lines=${c._count.lines}`);
    });

    const kaCodes = await prisma.customer.count({
      where: { customerCode: { startsWith: 'KA-' } },
    });
    console.log('Customers starting with KA-:', kaCodes);

    const nonKa = await prisma.customer.findMany({
      where: { NOT: { customerCode: { startsWith: 'KA-' } } },
      select: { id: true, customerCode: true, name: true, phone: true, _count: { select: { lines: true } } },
    });
    console.log('Customers NOT starting with KA- (total: ' + nonKa.length + '):');
    nonKa.forEach(c => {
      console.log(`  [${c.customerCode}] id=${c.id}, name="${c.name}", phone="${c.phone}", lines=${c._count.lines}`);
    });

    expect(totalCustomers).toBeGreaterThan(0);
  });
});
