import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { MonthlyChargeStatus, PaymentMethod } from '@alkabeer/shared';

describe('Payments & FIFO Allocation Engine', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findFirst: vi.fn(),
      },
      treasuryAccount: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      monthlyCharge: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      paymentAllocation: {
        create: vi.fn(),
      },
      treasuryTransaction: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = { record: vi.fn().mockResolvedValue({}) };
    service = new PaymentsService(mockPrisma, mockAudit);
  });

  it('Gate 9, 10 & 11: Allocates 250 EGP payment using FIFO across 3 outstanding charges (100, 100, 100)', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', name: 'طارق سامي' });
    mockPrisma.treasuryAccount.findUnique.mockResolvedValue({
      id: 'treasury-1',
      name: 'خزينة الكاش',
      currentBalance: 500,
      status: 'ACTIVE',
    });

    mockPrisma.payment.create.mockImplementation(({ data }: any) => ({
      id: 'pay-1',
      ...data,
    }));

    // Customer owes 3 months: July (100), August (100), September (100)
    mockPrisma.monthlyCharge.findMany.mockResolvedValue([
      { id: 'ch-july', billingMonth: '2026-07', dueDate: new Date('2026-07-01'), amount: 100, paidAmount: 0 },
      { id: 'ch-august', billingMonth: '2026-08', dueDate: new Date('2026-08-01'), amount: 100, paidAmount: 0 },
      { id: 'ch-september', billingMonth: '2026-09', dueDate: new Date('2026-09-01'), amount: 100, paidAmount: 0 },
    ]);

    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-10001',
      amount: 250,
      customer: { id: 'cust-1', name: 'طارق سامي' },
      allocations: [],
      treasuryTransactions: [],
    });

    await service.createPayment({
      customerId: 'cust-1',
      amount: 250,
      treasuryAccountId: 'treasury-1',
      paymentMethod: PaymentMethod.CASH,
    });

    // Verify 3 allocations were made: 100 for July, 100 for August, 50 for September
    expect(mockPrisma.paymentAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: 'pay-1', chargeId: 'ch-july', amount: 100 }),
      }),
    );
    expect(mockPrisma.paymentAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: 'pay-1', chargeId: 'ch-august', amount: 100 }),
      }),
    );
    expect(mockPrisma.paymentAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: 'pay-1', chargeId: 'ch-september', amount: 50 }),
      }),
    );

    // Verify July status -> PAID (100/100)
    expect(mockPrisma.monthlyCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch-july' },
        data: { paidAmount: 100, status: MonthlyChargeStatus.PAID },
      }),
    );

    // Verify August status -> PAID (100/100)
    expect(mockPrisma.monthlyCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch-august' },
        data: { paidAmount: 100, status: MonthlyChargeStatus.PAID },
      }),
    );

    // Verify September status -> PARTIALLY_PAID (50/100)
    expect(mockPrisma.monthlyCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch-september' },
        data: { paidAmount: 50, status: MonthlyChargeStatus.PARTIALLY_PAID },
      }),
    );

    // Treasury balance updated by 250 EGP
    expect(mockPrisma.treasuryAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'treasury-1' },
        data: { currentBalance: 750 }, // 500 + 250
      }),
    );
  });

  it('Gate 16: Reverses a payment, restores charge balances, and creates refund treasury movement', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      paymentNumber: 'PAY-10001',
      amount: 100,
      isReversed: false,
      allocations: [
        {
          id: 'alloc-1',
          amount: 100,
          charge: {
            id: 'ch-1',
            amount: 100,
            paidAmount: 100,
            status: MonthlyChargeStatus.PAID,
          },
        },
      ],
      treasuryTransactions: [
        {
          id: 'tx-1',
          amount: 100,
          accountId: 'treasury-1',
        },
      ],
      customer: { id: 'cust-1', name: 'طارق' },
    });

    mockPrisma.treasuryAccount.findUnique.mockResolvedValue({
      id: 'treasury-1',
      currentBalance: 800,
    });

    await service.reversePayment('pay-1', { reason: 'Wrong bank transfer reference' });

    // Payment marked as reversed
    expect(mockPrisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ isReversed: true }),
      }),
    );

    // Monthly charge reverted back to DUE
    expect(mockPrisma.monthlyCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ch-1' },
        data: { paidAmount: 0, status: MonthlyChargeStatus.DUE },
      }),
    );

    // Treasury refunded 100 EGP (800 - 100 = 700)
    expect(mockPrisma.treasuryAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'treasury-1' },
        data: { currentBalance: 700 },
      }),
    );
  });
});
