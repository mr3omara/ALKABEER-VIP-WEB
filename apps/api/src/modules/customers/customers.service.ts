import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { AuditAction, CustomerStatus } from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, currentUserId?: string) {
    const resolvedName = dto.fullName?.trim() || dto.name?.trim() || dto.shortName?.trim() || 'عميل جديد';
    const resolvedPhone = dto.contactNumber?.trim() || dto.phone?.trim() || '';

    if (resolvedPhone) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          phone: resolvedPhone,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new ConflictException(`Customer with phone number [${resolvedPhone}] already exists`);
      }
    }

    let customerCode = dto.customerCode?.trim();
    if (customerCode) {
      const existingCode = await this.prisma.customer.findUnique({
        where: { customerCode },
      });
      if (existingCode) {
        throw new ConflictException(`Customer with code [${customerCode}] already exists`);
      }
    } else {
      const customerCount = await this.prisma.customer.count();
      customerCode = `KA-${(customerCount + 1001).toString()}`;
    }

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          customerCode,
          name: resolvedName,
          shortName: dto.shortName?.trim() || undefined,
          fullName: dto.fullName?.trim() || undefined,
          phone: resolvedPhone || `NA-${Date.now()}`,
          contactNumber: dto.contactNumber?.trim() || undefined,
          motherGrandpaName: dto.motherGrandpaName?.trim() || undefined,
          nationalId: dto.nationalId?.trim() || undefined,
          address: dto.address?.trim() || undefined,
          joinDate: dto.joinDate ? new Date(dto.joinDate) : new Date(),
          notes: dto.notes?.trim() || undefined,
          openingBalance: (dto as any).openingBalance || 0,
          cachedBalance: (dto as any).openingBalance || 0,
          status: dto.status || CustomerStatus.ACTIVE,
        },
      });

      // Initialize ledger with opening balance
      const opBal = (dto as any).openingBalance || 0;
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          transactionNumber: `OP-${customer.customerCode}`,
          transactionType: 'OPENING_BALANCE',
          description: 'الرصيد الافتتاحي عند إنشاء الحساب',
          debit: opBal >= 0 ? opBal : 0,
          credit: opBal < 0 ? Math.abs(opBal) : 0,
          balanceAfter: opBal,
          createdBy: currentUserId,
        }
      });

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'Customer',
          entityId: customer.id,
          newData: customer,
          userId: currentUserId,
        },
        tx,
      );

      return customer;
    });
  }

  async findMany(pagination: PaginationDto, status?: CustomerStatus) {
    const where: any = {
      deletedAt: null,
    };

    if (status && typeof status === 'string' && (status as string).trim() !== '') {
      where.status = status;
    }

    if (pagination.search && pagination.search.trim() !== '') {
      const searchClean = pagination.search.trim();
      where.OR = [
        { name: { contains: searchClean, mode: 'insensitive' } },
        { fullName: { contains: searchClean, mode: 'insensitive' } },
        { phone: { contains: searchClean, mode: 'insensitive' } },
        { customerCode: { contains: searchClean, mode: 'insensitive' } },
        { nationalId: { contains: searchClean, mode: 'insensitive' } },
        { lines: { some: { phoneNumber: { contains: searchClean, mode: 'insensitive' } } } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              lines: true,
              sales: true,
              payments: true,
              monthlyCharges: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.limit),
        hasNextPage: pagination.page * pagination.limit < totalItems,
        hasPreviousPage: pagination.page > 1,
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        lines: {
          include: { company: true },
          orderBy: { createdAt: 'desc' },
        },
        lineHistoryOld: {
          include: {
            line: { include: { company: true } },
            newCustomer: { select: { id: true, name: true, customerCode: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          include: {
            items: {
              include: { line: { include: { company: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        payments: {
          include: {
            allocations: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        monthlyCharges: {
          include: { line: { include: { company: true } } },
          orderBy: { dueDate: 'desc' },
          take: 50,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, currentUserId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const resolvedPhone = dto.contactNumber !== undefined ? dto.contactNumber.trim() : dto.phone?.trim();
    if (resolvedPhone && resolvedPhone !== customer.phone) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          phone: resolvedPhone,
          id: { not: id },
          deletedAt: null,
        },
      });
      if (existing) {
        throw new ConflictException(`Phone number [${resolvedPhone}] is already in use by another customer`);
      }
    }

    const resolvedName = dto.fullName?.trim() || dto.name?.trim() || dto.shortName?.trim() || customer.name;

    const newCode = dto.customerCode?.trim();
    if (newCode && newCode !== customer.customerCode) {
      const existingCode = await this.prisma.customer.findUnique({
        where: { customerCode: newCode },
      });
      if (existingCode && existingCode.id !== id) {
        throw new ConflictException(`Customer with code [${newCode}] already exists`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          customerCode: newCode || undefined,
          name: resolvedName,
          shortName: dto.shortName !== undefined ? (dto.shortName.trim() || null) : undefined,
          fullName: dto.fullName !== undefined ? (dto.fullName.trim() || null) : undefined,
          phone: resolvedPhone || undefined,
          contactNumber: dto.contactNumber !== undefined ? (dto.contactNumber.trim() || null) : undefined,
          motherGrandpaName: dto.motherGrandpaName !== undefined ? (dto.motherGrandpaName.trim() || null) : undefined,
          nationalId: dto.nationalId !== undefined ? (dto.nationalId.trim() || null) : undefined,
          address: dto.address !== undefined ? (dto.address.trim() || null) : undefined,
          joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
          notes: dto.notes !== undefined ? (dto.notes.trim() || null) : undefined,
          status: dto.status,
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.UPDATE,
          entityType: 'Customer',
          entityId: id,
          oldData: customer,
          newData: updated,
          userId: currentUserId,
        },
        tx,
      );

      return updated;
    });
  }

  async softDelete(id: string, currentUserId?: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            lines: true,
            sales: true,
            payments: true,
            monthlyCharges: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Business rule: Do not delete customers with financial or sales history
    const historyCount =
      customer._count.lines +
      customer._count.sales +
      customer._count.payments +
      customer._count.monthlyCharges;

    if (historyCount > 0) {
      throw new BadRequestException(
        `Cannot delete customer [${customer.name}] because they have linked history (${customer._count.lines} lines, ${customer._count.sales} sales, ${customer._count.payments} payments). Deactivate the customer instead.`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.customer.update({
        where: { id },
        data: { deletedAt: new Date(), status: CustomerStatus.INACTIVE },
      });

      await this.auditService.record(
        {
          action: AuditAction.DELETE,
          entityType: 'Customer',
          entityId: id,
          oldData: customer,
          userId: currentUserId,
        },
        tx,
      );

      return { success: true };
    });
  }
}
