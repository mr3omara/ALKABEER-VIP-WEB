import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto, ReversePaymentDto } from './dto/payment.dto';
import {
  AuditAction,
  Money,
  MonthlyChargeStatus,
  PaymentMethod,
  TreasuryDirection,
  TreasuryTransactionType,
} from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * ATOMIC PAYMENT & FIFO ALLOCATION ENGINE WITH LEDGER
   */
  async createPayment(dto: CreatePaymentDto, currentUserId?: string) {
    Money.assertPositive(dto.amount, 'Payment Amount');

    const treasuryAccount = await this.prisma.treasuryAccount.findUnique({
      where: { id: dto.treasuryAccountId },
    });

    if (!treasuryAccount || treasuryAccount.status !== 'ACTIVE') {
      throw new BadRequestException('Selected treasury account is invalid or inactive');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Lock the customer row to prevent race conditions
      const customers = await tx.$queryRaw<any[]>`SELECT * FROM "customers" WHERE id = ${dto.customerId}::uuid FOR UPDATE`;
      if (!customers || customers.length === 0) {
        throw new NotFoundException('Customer not found');
      }
      const customer = customers[0];

      const paymentCount = await tx.payment.count();
      const paymentNumber = `PAY-${(paymentCount + 10001).toString()}`;

      // 2. Create base payment record
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          customerId: customer.id,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          reference: dto.reference,
          notes: dto.notes,
          createdBy: currentUserId,
        },
      });

      // 3. FIFO Allocation across outstanding monthly charges
      const outstandingCharges = await tx.monthlyCharge.findMany({
        where: {
          customerId: customer.id,
          status: { in: [MonthlyChargeStatus.DUE, MonthlyChargeStatus.PARTIALLY_PAID] },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });

      let remainingPayment = dto.amount;
      const createdAllocations = [];

      for (const charge of outstandingCharges) {
        if (remainingPayment <= 0) break;

        const unpaidOnCharge = Money.subtract(charge.amount, charge.paidAmount);
        if (unpaidOnCharge <= 0) continue;

        const allocationAmount = Math.min(remainingPayment, unpaidOnCharge);

        const allocation = await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            chargeId: charge.id,
            amount: allocationAmount,
          },
        });
        createdAllocations.push(allocation);

        const newPaidAmount = Money.add(charge.paidAmount, allocationAmount);
        const newStatus =
          newPaidAmount === charge.amount
            ? MonthlyChargeStatus.PAID
            : MonthlyChargeStatus.PARTIALLY_PAID;

        await tx.monthlyCharge.update({
          where: { id: charge.id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
          },
        });

        remainingPayment = Money.subtract(remainingPayment, allocationAmount);
      }

      // 3.2 Allocate to opening balance if any
      let openingReduction = 0;
      if (remainingPayment > 0 && customer.opening_balance > 0) {
        openingReduction = Math.min(remainingPayment, customer.opening_balance);
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            openingBalance: Money.subtract(customer.opening_balance, openingReduction),
          },
        });
        remainingPayment = Money.subtract(remainingPayment, openingReduction);
      }

      // 3.3 Allocate to unpaid sales FIFO
      if (remainingPayment > 0) {
        const unpaidSales = await tx.sale.findMany({
          where: {
            customerId: customer.id,
            remaining: { gt: 0 },
            status: { not: 'CANCELLED' },
          },
          orderBy: { saleDate: 'asc' },
        });

        for (const sale of unpaidSales) {
          if (remainingPayment <= 0) break;
          const saleAlloc = Math.min(remainingPayment, sale.remaining);
          const newPaid = Money.add(sale.paid, saleAlloc);
          const newRemaining = Money.subtract(sale.remaining, saleAlloc);
          const newStatus = newRemaining === 0 ? 'COMPLETED' : sale.status;

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paid: newPaid,
              remaining: newRemaining,
              status: newStatus as any,
            },
          });
          remainingPayment = Money.subtract(remainingPayment, saleAlloc);
        }
      }

      // 4. Update ledger and cached balance
      // cachedBalance: Positive = Debt, Negative = Credit
      const overpayment = remainingPayment; // Any left-over is overpayment/credit
      const appliedPayment = Money.subtract(dto.amount, overpayment);
      
      let currentBalance = customer.cached_balance;

      if (appliedPayment > 0) {
        currentBalance = Money.subtract(currentBalance, appliedPayment);
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionNumber: `L-${payment.paymentNumber}`,
            transactionType: 'PAYMENT',
            description: `سداد مستحقات (إيصال ${payment.paymentNumber})`,
            debit: 0,
            credit: appliedPayment,
            balanceAfter: currentBalance,
            referenceId: payment.id,
            createdBy: currentUserId,
          }
        });
      }

      if (overpayment > 0) {
        currentBalance = Money.subtract(currentBalance, overpayment);
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionNumber: `C-${payment.paymentNumber}`,
            transactionType: 'CREDIT_BALANCE',
            description: `رصيد دائن زائد (إيصال ${payment.paymentNumber})`,
            debit: 0,
            credit: overpayment,
            balanceAfter: currentBalance,
            referenceId: payment.id,
            createdBy: currentUserId,
          }
        });
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: { cachedBalance: currentBalance },
      });

      // 5. Create Treasury Transaction & update account balance
      const txCount = await tx.treasuryTransaction.count();
      const transactionNumber = `TX-${(txCount + 10001).toString()}`;

      await tx.treasuryTransaction.create({
        data: {
          transactionNumber,
          transactionType: TreasuryTransactionType.SALE_PAYMENT,
          direction: TreasuryDirection.IN,
          amount: dto.amount,
          accountId: treasuryAccount.id,
          paymentId: payment.id,
          description: `Payment received ${payment.paymentNumber} from ${customer.name}`,
          createdBy: currentUserId,
        },
      });

      await tx.treasuryAccount.update({
        where: { id: treasuryAccount.id },
        data: {
          currentBalance: Money.add(treasuryAccount.currentBalance, dto.amount),
        },
      });

      // 6. Record Audit Log
      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'Payment',
          entityId: payment.id,
          newData: {
            paymentNumber: payment.paymentNumber,
            customerId: customer.id,
            amount: dto.amount,
            allocationsCount: createdAllocations.length,
          },
          userId: currentUserId,
        },
        tx,
      );

      return this.findOne(payment.id, tx);
    });
  }

  /**
   * COMPENSATING PAYMENT REVERSAL ENGINE
   */
  async reversePayment(paymentId: string, dto: ReversePaymentDto, currentUserId?: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          allocations: {
            include: { charge: true },
          },
          treasuryTransactions: true,
          customer: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.isReversed) {
        throw new BadRequestException(`Payment [${payment.paymentNumber}] has already been reversed.`);
      }

      // Lock Customer
      await tx.$queryRaw`SELECT * FROM "customers" WHERE id = ${payment.customerId}::uuid FOR UPDATE`;
      const customer = await tx.customer.findUnique({ where: { id: payment.customerId } });

      // 1. Mark original payment as reversed
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          isReversed: true,
          reversalReason: dto.reason,
        },
      });

      // 2. Roll back monthly charge allocations
      for (const allocation of payment.allocations) {
        const charge = allocation.charge;
        const newPaidAmount = Money.subtract(charge.paidAmount, allocation.amount);
        const newStatus =
          newPaidAmount <= 0
            ? MonthlyChargeStatus.DUE
            : MonthlyChargeStatus.PARTIALLY_PAID;

        await tx.monthlyCharge.update({
          where: { id: charge.id },
          data: {
            paidAmount: Math.max(0, newPaidAmount),
            status: newStatus,
          },
        });
      }

      // 3. Reverse in Ledger (Offsetting Entry)
      const currentBalance = Money.add(customer.cachedBalance, payment.amount);
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          transactionNumber: `R-${payment.paymentNumber}`,
          transactionType: 'REVERSAL',
          description: `إلغاء الإيصال رقم ${payment.paymentNumber} - السبب: ${dto.reason}`,
          debit: payment.amount,
          credit: 0,
          balanceAfter: currentBalance,
          referenceId: payment.id,
          createdBy: currentUserId,
        }
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: { cachedBalance: currentBalance },
      });

      // 4. Compensate Treasury Movements
      for (const tTx of payment.treasuryTransactions) {
        const txCount = await tx.treasuryTransaction.count();
        const transactionNumber = `TX-${(txCount + 10001).toString()}`;

        await tx.treasuryTransaction.create({
          data: {
            transactionNumber,
            transactionType: TreasuryTransactionType.REFUND,
            direction: TreasuryDirection.OUT,
            amount: tTx.amount,
            accountId: tTx.accountId,
            paymentId: payment.id,
            description: `Reversal of payment ${payment.paymentNumber}. Reason: ${dto.reason}`,
            createdBy: currentUserId,
          },
        });

        const account = await tx.treasuryAccount.findUnique({
          where: { id: tTx.accountId },
        });
        if (account) {
          await tx.treasuryAccount.update({
            where: { id: account.id },
            data: {
              currentBalance: Money.subtract(account.currentBalance, tTx.amount),
            },
          });
        }
      }

      // 5. Record Audit Log
      await this.auditService.record(
        {
          action: AuditAction.REVERSAL,
          entityType: 'Payment',
          entityId: payment.id,
          oldData: { isReversed: false, amount: payment.amount },
          newData: { isReversed: true, reason: dto.reason },
          userId: currentUserId,
        },
        tx,
      );

      return updatedPayment;
    });
  }

  async findMany(pagination: PaginationDto, customerId?: string) {
    const where: any = {};
    if (customerId) where.customerId = customerId;

    if (pagination.search) {
      where.OR = [
        { paymentNumber: { contains: pagination.search, mode: 'insensitive' } },
        { customer: { name: { contains: pagination.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: pagination.search } } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, customerCode: true },
          },
          allocations: {
            include: {
              charge: {
                include: { line: true },
              },
            },
          },
          treasuryTransactions: true,
        },
      }),
      this.prisma.payment.count({ where }),
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

  async findOne(id: string, tx?: any) {
    const client = tx || this.prisma;
    const payment = await client.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        allocations: {
          include: {
            charge: {
              include: { line: true },
            },
          },
        },
        treasuryTransactions: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
