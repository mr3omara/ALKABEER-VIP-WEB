import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TreasuryService } from '../src/modules/treasury/treasury.service';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '@alkabeer/shared';

describe('Treasury & Expenses Module', () => {
  let treasuryService: TreasuryService;
  let expensesService: ExpensesService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      treasuryAccount: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      expenseCategory: {
        findUnique: vi.fn(),
      },
      expense: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findUnique: vi.fn(),
      },
      treasuryTransaction: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = { record: vi.fn().mockResolvedValue({}) };
    treasuryService = new TreasuryService(mockPrisma, mockAudit);
    expensesService = new ExpensesService(mockPrisma, mockAudit);
  });

  it('Gate 12 & 13: Creates expense and deducts amount from treasury account', async () => {
    mockPrisma.expenseCategory.findUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'إيجار المقر',
    });

    mockPrisma.treasuryAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      name: 'الخزينة الرئيسية',
      currentBalance: 5000,
      status: 'ACTIVE',
    });

    mockPrisma.expense.create.mockImplementation(({ data }: any) => ({
      id: 'exp-1',
      ...data,
    }));

    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 'exp-1',
      expenseNumber: 'EXP-10001',
      amount: 1500,
      category: { name: 'إيجار المقر' },
      treasuryAccount: { name: 'الخزينة الرئيسية' },
    });

    const result = await expensesService.createExpense({
      categoryId: 'cat-1',
      amount: 1500,
      treasuryAccountId: 'acc-1',
      paymentMethod: PaymentMethod.CASH,
      description: 'إيجار شهر أغسطس',
    });

    expect(result.amount).toBe(1500);
    // Deducted 1500 from 5000 = 3500
    expect(mockPrisma.treasuryAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'acc-1' },
        data: { currentBalance: 3500 },
      }),
    );
    expect(mockPrisma.treasuryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'OUT',
          amount: 1500,
          transactionType: 'EXPENSE',
        }),
      }),
    );
  });

  it('Rejects expense when treasury account has insufficient balance', async () => {
    mockPrisma.expenseCategory.findUnique.mockResolvedValue({ id: 'cat-1', name: 'إيجار' });
    mockPrisma.treasuryAccount.findUnique.mockResolvedValue({
      id: 'acc-1',
      name: 'الخزينة',
      currentBalance: 500,
      status: 'ACTIVE',
    });

    await expect(
      expensesService.createExpense({
        categoryId: 'cat-1',
        amount: 2000, // Exceeds 500
        treasuryAccountId: 'acc-1',
        description: 'Overdrawn expense',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
