import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomersService } from '../src/modules/customers/customers.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { CustomerStatus } from '@alkabeer/shared';

describe('Customers Module', () => {
  let service: CustomersService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue({}),
    };
    service = new CustomersService(mockPrisma, mockAudit);
  });

  it('Gate 1: Successfully creates a new customer with unique code and active status', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.create.mockImplementation(({ data }: any) => ({
      id: 'cust-1',
      ...data,
      createdAt: new Date(),
    }));

    const result = await service.create({
      name: 'أحمد محمود',
      phone: '01012345678',
    });

    expect(result.customerCode).toBe('KA-1001');
    expect(result.status).toBe(CustomerStatus.ACTIVE);
    expect(result.phone).toBe('01012345678');
    expect(mockAudit.record).toHaveBeenCalled();
  });

  it('Gate 1b: Preserves authoritative customerCode verbatim when provided', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customer.findUnique = vi.fn().mockResolvedValue(null);
    mockPrisma.customer.create.mockImplementation(({ data }: any) => ({
      id: 'cust-2',
      ...data,
      createdAt: new Date(),
    }));

    const result = await service.create({
      customerCode: 'KA-1003',
      name: 'Sob 25',
      phone: '01080001431',
    });

    expect(result.customerCode).toBe('KA-1003');
    expect(result.status).toBe(CustomerStatus.ACTIVE);
  });

  it('Gate 2: Rejects duplicate phone numbers at application and database level', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'existing-id', phone: '01012345678' });

    await expect(
      service.create({
        name: 'عميل مكرر',
        phone: '01012345678',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('Prevents soft deletion of customers with linked lines, sales, or financial history', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'cust-with-history',
      name: 'عميل لديه خطوط ومبيعات',
      _count: {
        lines: 2,
        sales: 1,
        payments: 1,
        monthlyCharges: 3,
      },
    });

    await expect(service.softDelete('cust-with-history')).rejects.toThrow(BadRequestException);
  });
});
