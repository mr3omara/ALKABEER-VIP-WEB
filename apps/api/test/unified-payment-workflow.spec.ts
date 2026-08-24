import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { ReportsService } from '../src/modules/reports/reports.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { PaymentMethod, MonthlyChargeStatus } from '@alkabeer/shared';

describe('Unified Payment & Settlement Workflow Test', () => {
  let prisma: PrismaClient;
  let paymentsService: PaymentsService;
  let reportsService: ReportsService;
  let customersService: CustomersService;
  let testTreasuryId: string;

  const mockAuditService: any = {
    record: async () => {},
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    paymentsService = new PaymentsService(prisma as any, mockAuditService);
    reportsService = new ReportsService(prisma as any);
    customersService = new CustomersService(prisma as any, mockAuditService);

    // Find or create active treasury account for testing
    let treasury = await prisma.treasuryAccount.findFirst({ where: { status: 'ACTIVE' } });
    if (!treasury) {
      treasury = await prisma.treasuryAccount.create({
        data: {
          name: 'الخزينة الرئيسية للاختبار',
          type: 'CASH',
          currentBalance: 10000,
          status: 'ACTIVE',
        },
      });
    }
    testTreasuryId = treasury.id;
  });

  it('1. PARTIAL PAYMENT: Correctly pays down opening balance and updates debtor position', async () => {
    // 1. Create a test customer with 1,000 EGP opening balance
    const testCust = await prisma.customer.create({
      data: {
        customerCode: `TEST-PAY-${Date.now().toString().slice(-4)}`,
        name: 'عميل اختبار سداد',
        phone: '01019999999',
        openingBalance: 1000,
        status: 'ACTIVE',
      },
    });

    // 2. Perform partial payment of 400 EGP
    const payment = await paymentsService.createPayment({
      customerId: testCust.id,
      amount: 400,
      paymentMethod: PaymentMethod.CASH,
      treasuryAccountId: testTreasuryId,
      notes: 'سداد جزئي للاختبار',
    });

    expect(payment).toBeDefined();
    expect(payment.amount).toBe(400);

    // 3. Verify Customer opening balance is reduced to 600 EGP
    const updatedCust = await prisma.customer.findUnique({ where: { id: testCust.id } });
    expect(updatedCust?.openingBalance).toBe(600);

    // 4. Perform remaining payment of 600 EGP (Full Settle)
    const finalPayment = await paymentsService.createPayment({
      customerId: testCust.id,
      amount: 600,
      paymentMethod: PaymentMethod.WALLET,
      treasuryAccountId: testTreasuryId,
      notes: 'سداد نهائي خالص',
    });

    expect(finalPayment.amount).toBe(600);

    // 5. Verify Customer opening balance is now exactly 0 EGP
    const settledCust = await prisma.customer.findUnique({ where: { id: testCust.id } });
    expect(settledCust?.openingBalance).toBe(0);

    // Clean up test customer and payments
    await prisma.treasuryTransaction.deleteMany({ where: { paymentId: { in: [payment.id, finalPayment.id] } } });
    await prisma.payment.deleteMany({ where: { id: { in: [payment.id, finalPayment.id] } } });
    await prisma.customer.delete({ where: { id: testCust.id } });
  });

  it('2. FIFO CHARGE CASCADE: Correctly allocates payment to monthly charges before opening balance', async () => {
    // 1. Create customer with 200 opening balance
    const testCust = await prisma.customer.create({
      data: {
        customerCode: `TEST-FIFO-${Date.now().toString().slice(-4)}`,
        name: 'عميل اختبار FIFO',
        phone: '01018888888',
        openingBalance: 200,
        status: 'ACTIVE',
      },
    });

    // 2. Create a test company & line
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: { name: 'فودافون بيزنس', code: 'VF-TEST', color: '#E60000' },
      });
    }

    const testLine = await prisma.line.create({
      data: {
        phoneNumber: `0109999${Date.now().toString().slice(-4)}`,
        companyId: company.id,
        customerId: testCust.id,
        monthlyPackage: 150,
        purchasePrice: 120,
        salePrice: 150,
        status: 'ACTIVE',
      },
    });

    // 3. Create 2 monthly charges (Charge 1: 150 due Jan, Charge 2: 150 due Feb)
    const charge1 = await prisma.monthlyCharge.create({
      data: {
        lineId: testLine.id,
        customerId: testCust.id,
        billingMonth: '2026-01',
        dueDate: new Date('2026-01-01'),
        amount: 150,
        paidAmount: 0,
        status: MonthlyChargeStatus.DUE,
      },
    });

    const charge2 = await prisma.monthlyCharge.create({
      data: {
        lineId: testLine.id,
        customerId: testCust.id,
        billingMonth: '2026-02',
        dueDate: new Date('2026-02-01'),
        amount: 150,
        paidAmount: 0,
        status: MonthlyChargeStatus.DUE,
      },
    });

    // Total debt is 150 + 150 + 200 = 500 EGP.
    // Make a payment of 350 EGP:
    // Charge 1 (150 EGP) => PAID in full
    // Charge 2 (150 EGP) => PAID in full
    // Remaining 50 EGP => reduces Opening Balance from 200 to 150 EGP
    const payment = await paymentsService.createPayment({
      customerId: testCust.id,
      amount: 350,
      paymentMethod: PaymentMethod.CASH,
      treasuryAccountId: testTreasuryId,
    });

    const updatedCharge1 = await prisma.monthlyCharge.findUnique({ where: { id: charge1.id } });
    const updatedCharge2 = await prisma.monthlyCharge.findUnique({ where: { id: charge2.id } });
    const updatedCust = await prisma.customer.findUnique({ where: { id: testCust.id } });

    expect(updatedCharge1?.status).toBe(MonthlyChargeStatus.PAID);
    expect(updatedCharge1?.paidAmount).toBe(150);

    expect(updatedCharge2?.status).toBe(MonthlyChargeStatus.PAID);
    expect(updatedCharge2?.paidAmount).toBe(150);

    expect(updatedCust?.openingBalance).toBe(150);

    // Clean up
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });
    await prisma.treasuryTransaction.deleteMany({ where: { paymentId: payment.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.monthlyCharge.deleteMany({ where: { id: { in: [charge1.id, charge2.id] } } });
    await prisma.line.delete({ where: { id: testLine.id } });
    await prisma.customer.delete({ where: { id: testCust.id } });
  });
});
