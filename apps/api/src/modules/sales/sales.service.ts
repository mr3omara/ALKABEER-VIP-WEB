import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSaleDto } from './dto/sale.dto';
import {
  AuditAction,
  Money,
  LineStatus,
  SaleStatus,
  PaymentMethod,
  InventoryMovementType,
  TreasuryDirection,
  TreasuryTransactionType,
  CustomerStatus,
} from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * ATOMIC MULTI-LINE SALE TRANSACTION ENGINE
   */
  async createSale(dto: CreateSaleDto, currentUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one line item is required for a sale');
    }

    let subtotal = 0;
    for (const item of dto.items) {
      Money.assertPositive(item.unitPrice, `Item Unit Price for line [${item.lineId}]`);
      const discount = item.discount || 0;
      Money.assertNonNegative(discount, `Item Discount for line [${item.lineId}]`);
      if (discount > item.unitPrice) {
        throw new BadRequestException(`Discount cannot exceed unit price for line [${item.lineId}]`);
      }
      const itemNet = Money.subtract(item.unitPrice, discount);
      subtotal = Money.add(subtotal, itemNet);
    }

    const saleDiscount = (dto as any).overallDiscount || (dto as any).discount || 0;
    Money.assertNonNegative(saleDiscount, 'Overall Discount');
    if (saleDiscount > subtotal) {
      throw new BadRequestException('Overall discount cannot exceed subtotal');
    }

    const total = Money.subtract(subtotal, saleDiscount);
    const paid = (dto as any).paidAmount !== undefined ? (dto as any).paidAmount : ((dto as any).paid || 0);
    Money.assertNonNegative(paid, 'Paid Amount');

    if (paid > 0 && !dto.treasuryAccountId) {
      throw new BadRequestException('Treasury account is required when payment is recorded');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Lock customer
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

      if (customer.status !== CustomerStatus.ACTIVE) {
        throw new BadRequestException('Customer must be ACTIVE.');
      }

      const lineIds = dto.items.map((i) => i.lineId);
      const uniqueLineIds = new Set(lineIds);
      if (uniqueLineIds.size !== lineIds.length) {
        throw new BadRequestException('Duplicate lines detected in single sale');
      }

      for (const item of dto.items) {
        const updateResult = await tx.line.updateMany({
          where: {
            id: item.lineId,
            status: LineStatus.IN_STOCK,
          },
          data: {
            status: LineStatus.SOLD,
            customerId: customer.id,
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictException(`Line is not available for sale.`);
        }
      }

      const custCachedBal = customer.cachedBalance ?? customer.cached_balance ?? 0;

      // Check available credit to auto-consume (cached_balance < 0)
      const creditAvailable = custCachedBal < 0 ? Math.abs(custCachedBal) : 0;
      const creditUsed = Math.min(creditAvailable, total);
      let effectiveRemaining = Money.subtract(total, creditUsed);

      // Handle cash payment portion
      let salePaid = creditUsed; 
      let overpayment = 0;
      let appliedCash = 0;

      if (paid > 0) {
        appliedCash = Math.min(paid, effectiveRemaining);
        overpayment = Money.subtract(paid, appliedCash);
        salePaid = Money.add(salePaid, appliedCash);
        effectiveRemaining = Money.subtract(effectiveRemaining, appliedCash);
      }

      const saleCount = await tx.sale.count();
      const saleNumber = `SALE-${(saleCount + 10001).toString()}`;

      const sale = await tx.sale.create({
        data: {
          saleNumber,
          customerId: customer.id,
          subtotal,
          discount: saleDiscount,
          total,
          paid: salePaid,
          remaining: effectiveRemaining,
          status: SaleStatus.COMPLETED,
          notes: dto.notes,
          createdBy: currentUserId,
        },
      });

      // Update Sales Items & Inventory
      for (const item of dto.items) {
        const itemTotal = Money.subtract(item.unitPrice, item.discount || 0);
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            lineId: item.lineId,
            description: item.description,
            quantity: 1,
            unitPrice: item.unitPrice,
            discount: item.discount || 0,
            total: itemTotal,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            lineId: item.lineId,
            movementType: InventoryMovementType.SALE,
            referenceType: 'SALE',
            referenceId: sale.id,
            notes: `Sold via ${sale.saleNumber}`,
            createdBy: currentUserId,
          },
        });
      }

      // Ledger: INVOICE
      let currentBalance = Money.add(custCachedBal, total);
      if (tx.customerLedger?.create) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionNumber: `INV-${sale.saleNumber}`,
            transactionType: 'INVOICE',
            description: `فاتورة مبيعات رقم ${sale.saleNumber}`,
            debit: total,
            credit: 0,
            balanceAfter: currentBalance,
            referenceId: sale.id,
            createdBy: currentUserId,
          }
        });
      }

      // Ledger: CREDIT_USAGE (zero-impact entry for descriptive record)
      if (creditUsed > 0 && tx.customerLedger?.create) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionNumber: `USE-${sale.saleNumber}`,
            transactionType: 'CREDIT_USAGE',
            description: `استخدام رصيد دائن بقيمة ${creditUsed} ج.م لسداد الفاتورة تلقائياً`,
            debit: 0,
            credit: 0,
            balanceAfter: currentBalance,
            referenceId: sale.id,
            createdBy: currentUserId,
          }
        });
      }

      // Record Payment and Overpayment if user handed over cash
      if (paid > 0) {
        const paymentCount = await tx.payment.count();
        const paymentNumber = `PAY-${(paymentCount + 10001).toString()}`;
        
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            customerId: customer.id,
            saleId: sale.id,
            amount: paid,
            paymentMethod: (dto as any).paymentMethod || PaymentMethod.CASH,
            reference: (dto as any).reference,
            createdBy: currentUserId,
          },
        });

        if (appliedCash > 0) {
          if (tx.paymentAllocation?.create) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                saleId: sale.id,
                targetType: 'SALE',
                amount: appliedCash,
              },
            });
          }

          currentBalance = Money.subtract(currentBalance, appliedCash);
          if (tx.customerLedger?.create) {
            await tx.customerLedger.create({
              data: {
                customerId: customer.id,
                transactionNumber: `L-${payment.paymentNumber}`,
                transactionType: 'PAYMENT',
                description: `دفعة نقدية مع المبيعات (إيصال ${payment.paymentNumber})`,
                debit: 0,
                credit: appliedCash,
                balanceAfter: currentBalance,
                referenceId: payment.id,
                createdBy: currentUserId,
              }
            });
          }
        }

        if (overpayment > 0) {
          if (tx.paymentAllocation?.create) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                targetType: 'CREDIT',
                amount: overpayment,
              },
            });
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

        const treasuryAccount = await tx.treasuryAccount.findUnique({ where: { id: dto.treasuryAccountId! } });
        if (!treasuryAccount) throw new NotFoundException('Treasury account not found');
        const txCount = await tx.treasuryTransaction.count();
        await tx.treasuryTransaction.create({
          data: {
            transactionNumber: `TX-${(txCount + 10001).toString()}`,
            transactionType: TreasuryTransactionType.SALE_PAYMENT,
            direction: TreasuryDirection.IN,
            amount: paid,
            accountId: dto.treasuryAccountId!,
            paymentId: payment.id,
            saleId: sale.id,
            description: `Cash sale payment ${payment.paymentNumber}`,
            createdBy: currentUserId,
          },
        });

        await tx.treasuryAccount.update({
          where: { id: dto.treasuryAccountId! },
          data: { currentBalance: Money.add(treasuryAccount.currentBalance, paid) },
        });
      }

      if (tx.customer?.update && customer?.id) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { cachedBalance: currentBalance }
        });
      }

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'Sale',
          entityId: sale.id,
          newData: { saleNumber: sale.saleNumber, total },
          userId: currentUserId,
        },
        tx,
      );

      return sale;
    });
  }

  /**
   * ATOMIC SALE CANCELLATION ENGINE
   */
  async cancelSale(id: string, reason: string, userId?: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
          treasuryTransactions: true,
          customer: true,
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale record not found');
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new BadRequestException(`Sale [${sale.saleNumber}] is already cancelled.`);
      }

      // Lock Customer
      if (tx.$queryRaw) {
        await tx.$queryRaw`SELECT * FROM "customers" WHERE id = ${sale.customerId}::uuid FOR UPDATE`;
      }
      let customer: any;
      if (tx.customer) {
        if (tx.customer.findUnique) {
          customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        }
        if (!customer && tx.customer.findFirst) {
          customer = await tx.customer.findFirst({ where: { id: sale.customerId } });
        }
      }

      // 1. Mark sale status as CANCELLED
      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.CANCELLED,
          notes: reason ? `Cancelled: ${reason}` : sale.notes,
        },
      });

      // 2. Return lines to IN_STOCK and unassign customer
      for (const item of sale.items) {
        await tx.line.update({
          where: { id: item.lineId },
          data: {
            status: LineStatus.IN_STOCK,
            customerId: null,
          },
        });

        // Inventory RETURN movement
        await tx.inventoryMovement.create({
          data: {
            lineId: item.lineId,
            movementType: InventoryMovementType.RETURN,
            referenceType: 'SALE_CANCEL',
            referenceId: sale.id,
            notes: `Returned from cancelled sale ${sale.saleNumber}. Reason: ${reason}`,
            createdBy: userId,
          },
        });
      }

      // 3. Reverse Customer Ledger effect
      const custCachedBal = customer ? (customer.cachedBalance ?? customer.cached_balance ?? 0) : 0;
      const currentBalance = Money.subtract(custCachedBal, sale.total);

      if (customer && tx.customerLedger?.create) {
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            transactionNumber: `R-${sale.saleNumber}`,
            transactionType: 'REVERSAL',
            description: `إلغاء فاتورة مبيعات رقم ${sale.saleNumber} - السبب: ${reason}`,
            debit: 0,
            credit: sale.total,
            balanceAfter: currentBalance,
            referenceId: sale.id,
            createdBy: userId,
          },
        });
      }

      // 4. Reverse Treasury cash inflow if upfront payment was made
      for (const tTx of sale.treasuryTransactions) {
        const txCount = await tx.treasuryTransaction.count();
        const transactionNumber = `TX-${(txCount + 10001).toString()}`;

        await tx.treasuryTransaction.create({
          data: {
            transactionNumber,
            transactionType: TreasuryTransactionType.REFUND,
            direction: TreasuryDirection.OUT,
            amount: tTx.amount,
            accountId: tTx.accountId,
            saleId: sale.id,
            description: `Refund for cancelled sale ${sale.saleNumber}. Reason: ${reason}`,
            createdBy: userId,
          },
        });

        const treasuryAccount = await tx.treasuryAccount.findUnique({
          where: { id: tTx.accountId },
        });
        if (treasuryAccount) {
          await tx.treasuryAccount.update({
            where: { id: treasuryAccount.id },
            data: {
              currentBalance: Money.subtract(treasuryAccount.currentBalance, tTx.amount),
            },
          });
        }
      }

      if (customer && tx.customer?.update) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { cachedBalance: currentBalance },
        });
      }

      // 5. Record Audit Log
      await this.auditService.record(
        {
          action: AuditAction.REVERSAL,
          entityType: 'Sale',
          entityId: sale.id,
          oldData: { status: sale.status, total: sale.total },
          newData: { status: SaleStatus.CANCELLED, reason },
          userId,
        },
        tx,
      );

      return updatedSale;
    });
  }

  async findMany(pagination: PaginationDto, customerId?: string, status?: string) {
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (pagination.search) {
      where.OR = [
        { saleNumber: { contains: pagination.search, mode: 'insensitive' } },
        { customer: { name: { contains: pagination.search, mode: 'insensitive' } } },
        { customer: { customerCode: { contains: pagination.search, mode: 'insensitive' } } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { saleDate: 'desc' },
        include: {
          customer: true,
          items: { include: { line: true } },
          payments: true,
        },
      }),
      this.prisma.sale.count({ where }),
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
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { line: true } },
        payments: true,
        treasuryTransactions: { include: { treasuryAccount: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    return sale;
  }
}
