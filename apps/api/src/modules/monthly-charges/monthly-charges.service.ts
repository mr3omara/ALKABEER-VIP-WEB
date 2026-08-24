import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMonthlyChargeDto } from './dto/monthly-charge.dto';
import { AuditAction, Money, MonthlyChargeStatus } from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class MonthlyChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateMonthlyChargeDto, currentUserId?: string) {
    Money.assertPositive(dto.amount, 'Charge Amount');

    const line = await this.prisma.line.findUnique({
      where: { id: dto.lineId },
    });

    if (!line) {
      throw new NotFoundException('Line not found');
    }

    if (!line.customerId) {
      throw new BadRequestException('Cannot generate monthly charge for a line without an assigned customer');
    }

    // Check unique constraint for (lineId, billingMonth)
    const existing = await this.prisma.monthlyCharge.findUnique({
      where: {
        lineId_billingMonth: {
          lineId: dto.lineId,
          billingMonth: dto.billingMonth,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Monthly charge for line [${line.phoneNumber}] and month [${dto.billingMonth}] already exists`,
      );
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Lock customer row
      const customers = await tx.$queryRaw<any[]>`SELECT * FROM "customers" WHERE id = ${line.customerId}::uuid FOR UPDATE`;
      if (!customers || customers.length === 0) {
        throw new NotFoundException('Customer not found');
      }
      const customer = customers[0];

      // Check available credit (cached_balance < 0 means credit)
      const creditAvailable = customer.cached_balance < 0 ? Math.abs(customer.cached_balance) : 0;
      const creditUsed = Math.min(creditAvailable, dto.amount);
      const remainingDebt = Money.subtract(dto.amount, creditUsed);

      const charge = await tx.monthlyCharge.create({
        data: {
          lineId: dto.lineId,
          customerId: line.customerId!,
          billingMonth: dto.billingMonth,
          dueDate: new Date(dto.dueDate),
          amount: dto.amount,
          paidAmount: creditUsed,
          status: creditUsed === dto.amount ? MonthlyChargeStatus.PAID : (creditUsed > 0 ? MonthlyChargeStatus.PARTIALLY_PAID : MonthlyChargeStatus.DUE),
          notes: dto.notes,
        },
        include: {
          line: true,
          customer: true,
        },
      });

      // Update customer balance: add charge debit (credit usage does not change net position as it was already paid)
      const currentBalance = Money.add(customer.cached_balance, dto.amount);
      await tx.customer.update({
        where: { id: customer.id },
        data: { cachedBalance: currentBalance },
      });

      // 2. Ledger Entries
      // Entry 1: INVOICE (Debit)
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          transactionNumber: `INV-${charge.billingMonth}-${line.phoneNumber.slice(-4)}`,
          transactionType: 'INVOICE',
          description: `فاتورة الشهر ${charge.billingMonth} للخط ${line.phoneNumber}`,
          debit: dto.amount,
          credit: 0,
          balanceAfter: Money.add(customer.cached_balance, dto.amount),
          referenceId: charge.id,
          createdBy: currentUserId,
        }
      });

      // Entry 2: CREDIT_USAGE if credit was used to settle it (zero-financial impact ledger entry for descriptive purposes)
      if (creditUsed > 0) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionNumber: `USE-${charge.billingMonth}-${line.phoneNumber.slice(-4)}`,
            transactionType: 'CREDIT_USAGE',
            description: `استخدام رصيد دائن بقيمة ${creditUsed} ج.م لسداد الفاتورة تلقائياً`,
            debit: 0,
            credit: 0, // Zero financial impact to prevent double counting
            balanceAfter: currentBalance,
            referenceId: charge.id,
            createdBy: currentUserId,
          }
        });
      }

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'MonthlyCharge',
          entityId: charge.id,
          newData: charge,
          userId: currentUserId,
        },
        tx,
      );

      return charge;
    });
  }

  async findMany(
    pagination: PaginationDto,
    customerId?: string,
    lineId?: string,
    billingMonth?: string,
    status?: MonthlyChargeStatus,
  ) {
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (lineId) where.lineId = lineId;
    if (billingMonth) where.billingMonth = billingMonth;
    if (status) where.status = status;

    const [items, totalItems] = await Promise.all([
      this.prisma.monthlyCharge.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          line: true,
          customer: true,
        },
      }),
      this.prisma.monthlyCharge.count({ where }),
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
    const charge = await this.prisma.monthlyCharge.findUnique({
      where: { id },
      include: {
        line: true,
        customer: true,
      },
    });

    if (!charge) {
      throw new NotFoundException('Monthly charge not found');
    }

    return charge;
  }
}
