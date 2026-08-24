import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LinesService } from '../src/modules/lines/lines.service';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { ConflictException } from '@nestjs/common';
import { LineStatus, InventoryMovementType } from '@alkabeer/shared';

describe('Lines & Inventory Ledger Module', () => {
  let linesService: LinesService;
  let inventoryService: InventoryService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      company: {
        findUnique: vi.fn().mockResolvedValue({ id: 'comp-1', name: 'Vodafone', paymentDay: 1 }),
      },
      line: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      inventoryMovement: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      lineHistory: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = { record: vi.fn().mockResolvedValue({}) };
    linesService = new LinesService(mockPrisma, mockAudit);
    inventoryService = new InventoryService(mockPrisma, mockAudit);
  });

  it('Gate 3 & 4: Creates a line with IN_STOCK status and records an immutable inventory movement', async () => {
    mockPrisma.line.findUnique.mockResolvedValue(null);
    mockPrisma.line.create.mockImplementation(({ data }: any) => ({
      id: 'line-1',
      ...data,
    }));

    const result = await linesService.create({
      phoneNumber: '01099887766',
      companyId: 'comp-1',
      purchasePrice: 50,
      salePrice: 150,
      monthlyPackage: 100,
    });

    expect(result.status).toBe(LineStatus.IN_STOCK);
    expect(result.phoneNumber).toBe('01099887766');
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineId: 'line-1',
          movementType: InventoryMovementType.PURCHASE,
          quantity: 1,
        }),
      }),
    );
    expect(mockPrisma.lineHistory.create).toHaveBeenCalled();
  });

  it('Rejects duplicate line phone numbers', async () => {
    mockPrisma.line.findUnique.mockResolvedValue({ id: 'existing', phoneNumber: '01099887766' });

    await expect(
      linesService.create({
        phoneNumber: '01099887766',
        companyId: 'comp-1',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
