import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SalesService } from '../src/modules/sales/sales.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CustomerStatus, LineStatus, SaleStatus, InventoryMovementType } from '@alkabeer/shared';

describe('Sales Engine: Atomic Multi-Line Transactions & Concurrency', () => {
  let service: SalesService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findFirst: vi.fn(),
      },
      line: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      sale: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      saleItem: {
        create: vi.fn(),
      },
      inventoryMovement: {
        create: vi.fn(),
      },
      lineHistory: {
        create: vi.fn(),
      },
      payment: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      treasuryAccount: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      treasuryTransaction: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = { record: vi.fn().mockResolvedValue({}) };
    service = new SalesService(mockPrisma, mockAudit);
  });

  it('Gate 5 & 8: Protects against concurrent sales and rejects selling unavailable/sold line', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'علي حسن',
      status: CustomerStatus.ACTIVE,
    });

    // Simulates line is already sold or reserved concurrently (updateMany returns count 0)
    mockPrisma.line.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.line.findUnique.mockResolvedValue({
      id: 'line-1',
      phoneNumber: '01011112222',
      status: LineStatus.SOLD,
    });

    await expect(
      service.createSale({
        customerId: 'cust-1',
        items: [{ lineId: 'line-1', unitPrice: 200 }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('Gate 6: Executes successful multi-line sale atomically with payment and treasury update', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'علي حسن',
      status: CustomerStatus.ACTIVE,
    });

    // Both lines are IN_STOCK
    mockPrisma.line.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.treasuryAccount.findUnique.mockResolvedValue({
      id: 'treasury-1',
      name: 'الخزينة الرئيسية',
      currentBalance: 1000,
      status: 'ACTIVE',
    });

    mockPrisma.sale.create.mockImplementation(({ data }: any) => ({
      id: 'sale-1',
      ...data,
    }));
    mockPrisma.payment.create.mockImplementation(({ data }: any) => ({
      id: 'pay-1',
      ...data,
    }));

    mockPrisma.sale.findUnique.mockResolvedValue({
      id: 'sale-1',
      saleNumber: 'SALE-10001',
      subtotal: 500,
      total: 500,
      paid: 500,
      status: SaleStatus.COMPLETED,
      items: [
        { lineId: 'line-1', unitPrice: 250, total: 250 },
        { lineId: 'line-2', unitPrice: 250, total: 250 },
      ],
    });

    const result = await service.createSale({
      customerId: 'cust-1',
      items: [
        { lineId: 'line-1', unitPrice: 250 },
        { lineId: 'line-2', unitPrice: 250 },
      ],
      paid: 500,
      treasuryAccountId: 'treasury-1',
    });

    expect(result.status).toBe(SaleStatus.COMPLETED);
    expect(result.total).toBe(500);
    expect(mockPrisma.line.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasuryTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.treasuryAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'treasury-1' },
        data: { currentBalance: 1500 }, // 1000 + 500 EGP
      }),
    );
  });

  it('Gate 7: Sale rollback occurs if database transaction encounters an error mid-flight', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      name: 'علي حسن',
      status: CustomerStatus.ACTIVE,
    });
    mockPrisma.line.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sale.create.mockRejectedValue(new Error('Database disk write failure'));

    await expect(
      service.createSale({
        customerId: 'cust-1',
        items: [{ lineId: 'line-1', unitPrice: 200 }],
      }),
    ).rejects.toThrow('Database disk write failure');
  });
});
