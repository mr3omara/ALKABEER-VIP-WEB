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
      let customer: any;
      if (tx.$queryRaw) {
        const customers = await tx.$queryRaw<any[]>`SELECT * FROM "customers" WHERE id = ${dto.customerId}::uuid FOR UPDATE`;
        if (customers && customers.length > 0) {
          customer = customers[0];
        }
      }
      if (!customer && tx.customer) {
        if (tx.customer.findUnique) {
          customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
        }
        if (!customer && tx.customer.findFirst) {
          customer = await tx.customer.findFirst({ where: { id: dto.customerId } });
        }
      }
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const custOpeningBal = customer.openingBalance ?? customer.opening_balance ?? 0;
      const custCachedBal = customer.cachedBalance ?? customer.cached_balance ?? 0;

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
            targetType: 'CHARGE',
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
      if (remainingPayment > 0 && custOpeningBal > 0) {
        openingReduction = Math.min(remainingPayment, custOpeningBal);
        const alloc = await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            targetType: 'OPENING_BALANCE',
            amount: openingReduction,
          },
        });
        createdAllocations.push(alloc);

        await tx.customer.update({
          where: { id: customer.id },
          data: {
            openingBalance: Money.subtract(custOpeningBal, openingReduction),
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

          const alloc = await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              saleId: sale.id,
              targetType: 'SALE',
              amount: saleAlloc,
            },
          });
          createdAllocations.push(alloc);

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
      
      let currentBalance = custCachedBal;

      if (appliedPayment > 0 && tx.customerLedger?.create) {
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
        if (tx.paymentAllocation?.create) {
          const alloc = await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              targetType: 'CREDIT',
              amount: overpayment,
            },
          });
          createdAllocations.push(alloc);
        }

        currentBalance = Money.subtract(currentBalance, overpayment);
        if (tx.customerLedger?.create) {
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
      }

      if (tx.customer?.update && customer?.id) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { cachedBalance: currentBalance },
        });
      }

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
            include: { charge: true, sale: true },
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
      if (tx.$queryRaw) {
        await tx.$queryRaw`SELECT * FROM "customers" WHERE id = ${payment.customerId}::uuid FOR UPDATE`;
      }
      let customer: any;
      if (tx.customer) {
        if (tx.customer.findUnique) {
          customer = await tx.customer.findUnique({ where: { id: payment.customerId } });
        }
        if (!customer && tx.customer.findFirst) {
          customer = await tx.customer.findFirst({ where: { id: payment.customerId } });
        }
      }

      // 1. Mark original payment as reversed
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          isReversed: true,
          reversalReason: dto.reason,
        },
      });

      // 2. Roll back all allocations based on allocation Breakdown
      for (const allocation of payment.allocations) {
        if ((!allocation.targetType || allocation.targetType === 'CHARGE') && allocation.charge) {
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
        } else if (allocation.targetType === 'OPENING_BALANCE') {
          const curOp = customer.openingBalance ?? (customer as any).opening_balance ?? 0;
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              openingBalance: Money.add(curOp, allocation.amount),
            },
          });
        } else if (allocation.targetType === 'SALE' && allocation.sale) {
          const sale = allocation.sale;
          const newPaid = Math.max(0, Money.subtract(sale.paid, allocation.amount));
          const newRemaining = Money.add(sale.remaining, allocation.amount);
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paid: newPaid,
              remaining: newRemaining,
              status: 'COMPLETED' as any,
            },
          });
        }
      }

      // 3. Reverse in Ledger (Offsetting Entry)
      const custCachedBal = customer ? (customer.cachedBalance ?? (customer as any).cached_balance ?? 0) : 0;
      const currentBalance = Money.add(custCachedBal, payment.amount);
      if (customer && tx.customerLedger?.create) {
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
      }

      if (customer && tx.customer?.update) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { cachedBalance: currentBalance },
        });
      }

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

  async findMany(pagination: PaginationDto, search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { customerCode: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          allocations: {
            include: {
              charge: {
                include: { line: true },
              },
              sale: true,
            },
          },
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

  async findOne(id: string, txClient?: any) {
    const client = txClient || this.prisma;
    const payment = await client.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        allocations: {
          include: {
            charge: {
              include: { line: true },
            },
            sale: true,
          },
        },
        treasuryTransactions: {
          include: { treasuryAccount: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }
}
