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
  CustomerStatus,
  InventoryMovementType,
  LineStatus,
  Money,
  PaymentMethod,
  SaleStatus,
  TreasuryDirection,
  TreasuryTransactionType,
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
   * ATOMIC MULTI-LINE SALE TRANSACTION WITH LEDGER
   */
  async createSale(dto: CreateSaleDto, currentUserId?: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('A sale must include at least one line item');
    }

    let subtotal = 0;
    for (const item of dto.items) {
      Money.assertNonNegative(item.unitPrice, 'Item Unit Price');
      Money.assertNonNegative(item.discount || 0, 'Item Discount');
      const itemTotal = Money.subtract(item.unitPrice, item.discount || 0);
      if (itemTotal < 0) {
        throw new BadRequestException('Item discount cannot exceed unit price');
      }
      subtotal = Money.add(subtotal, itemTotal);
    }

    const saleDiscount = dto.discount || 0;
    Money.assertNonNegative(saleDiscount, 'Sale Discount');
    if (saleDiscount > subtotal) {
      throw new BadRequestException('Overall sale discount cannot exceed subtotal');
    }

    const total = Money.subtract(subtotal, saleDiscount);
    const paid = dto.paid || 0;
    Money.assertNonNegative(paid, 'Paid Amount');

    if (paid > 0 && !dto.treasuryAccountId) {
      throw new BadRequestException('Treasury account is required when payment is recorded');
    }

    return this.prisma.$transaction(async (tx: any) => {
      // 1. Lock customer
      const customers = await tx.$queryRaw<any[]>`SELECT * FROM "customers" WHERE id = ${dto.customerId}::uuid FOR UPDATE`;
      if (!customers || customers.length === 0) throw new NotFoundException('Customer not found');
      const customer = customers[0];

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

      // Check available credit to auto-consume (cached_balance < 0)
      const creditAvailable = customer.cached_balance < 0 ? Math.abs(customer.cached_balance) : 0;
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
      let currentBalance = Money.add(customer.cached_balance, total);
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

      // Ledger: CREDIT_USAGE (zero-impact entry to prevent double counting)
      if (creditUsed > 0) {
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
          currentBalance = Money.subtract(currentBalance, appliedCash);
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

      await tx.customer.update({
        where: { id: customer.id },
        data: { cachedBalance: currentBalance }
      });

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

  async cancelSale(id: string, reason: string, userId: string) {
    return this.prisma.sale.update({
      where: { id },
      data: { status: 'CANCELLED' as any, notes: reason }
    });
  }

  async findMany(pagination: PaginationDto, customerId?: string) {
    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (pagination.search) {
      where.OR = [
        { saleNumber: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    const [items, totalItems] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { include: { line: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { items, meta: { totalItems } };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { line: true } },
        payments: true,
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }
}
