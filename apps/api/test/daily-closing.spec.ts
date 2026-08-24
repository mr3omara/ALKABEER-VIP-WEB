import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyClosingService } from '../src/modules/daily-closing/daily-closing.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { DailyClosingStatus } from '@alkabeer/shared';

describe('Daily Closing & Reconciliation Module', () => {
  let service: DailyClosingService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      dailyClosing: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      sale: { findMany: vi.fn() },
      payment: { findMany: vi.fn() },
      expense: { findMany: vi.fn() },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = { record: vi.fn().mockResolvedValue({}) };
    service = new DailyClosingService(mockPrisma, mockAudit);
  });

  it('Gate 17: Opens day, reconciles totals, and computes difference correctly', async () => {
    // 1. Open shift with 2000 EGP
    mockPrisma.dailyClosing.findUnique.mockResolvedValueOnce(null);
    mockPrisma.dailyClosing.create.mockImplementation(({ data }: any) => ({
      id: 'dc-1',
      ...data,
    }));

    const opened = await service.openDay({
      businessDate: '2026-08-22',
      openingBalance: 2000,
    });
    expect(opened.status).toBe(DailyClosingStatus.OPEN);
    expect(opened.openingBalance).toBe(2000);

    // 2. Day transactions: Sales = 5000, Payments = 3500, Expenses = 1000
    mockPrisma.dailyClosing.findUnique.mockResolvedValue({
      id: 'dc-1',
      businessDate: '2026-08-22',
      openingBalance: 2000,
      status: DailyClosingStatus.OPEN,
    });

    mockPrisma.sale.findMany.mockResolvedValue([{ total: 3000 }, { total: 2000 }]);
    mockPrisma.payment.findMany.mockResolvedValue([{ amount: 2000 }, { amount: 1500 }]);
    mockPrisma.expense.findMany.mockResolvedValue([{ amount: 600 }, { amount: 400 }]);

    // Expected physical balance = opening (2000) + payments (3500) - expenses (1000) = 4500 EGP
    // Cashier counts 4600 EGP (surplus of +100 EGP)
    mockPrisma.dailyClosing.update.mockImplementation(({ data }: any) => ({
      id: 'dc-1',
      ...data,
    }));

    const closed = await service.closeDay('2026-08-22', {
      actualBalance: 4600,
      notes: '100 EGP surplus observed',
    });

    expect(closed.totalSales).toBe(5000);
    expect(closed.totalPayments).toBe(3500);
    expect(closed.totalExpenses).toBe(1000);
    expect(closed.expectedBalance).toBe(4500);
    expect(closed.actualBalance).toBe(4600);
    expect(closed.difference).toBe(100); // 4600 - 4500 = +100
    expect(closed.status).toBe(DailyClosingStatus.CLOSED);
  });

  it('Allows reopening a closed shift and records audit trace', async () => {
    mockPrisma.dailyClosing.findUnique.mockResolvedValue({
      id: 'dc-1',
      businessDate: '2026-08-22',
      status: DailyClosingStatus.CLOSED,
    });
    mockPrisma.dailyClosing.update.mockImplementation(({ data }: any) => ({
      id: 'dc-1',
      ...data,
    }));

    const reopened = await service.reopenDay('2026-08-22', {
      reason: 'Need to enter late cash payment before final audit',
    });

    expect(reopened.status).toBe(DailyClosingStatus.REOPENED);
    expect(mockAudit.record).toHaveBeenCalled();
  });
});
