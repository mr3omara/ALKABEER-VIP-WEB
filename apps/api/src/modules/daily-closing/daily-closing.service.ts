import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CloseDailyClosingDto,
  OpenDailyClosingDto,
  ReopenDailyClosingDto,
} from './dto/daily-closing.dto';
import { AuditAction, DailyClosingStatus, Money, PaymentMethod } from '@alkabeer/shared';

@Injectable()
export class DailyClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to dynamically calculate Egypt (Africa/Cairo) start & end of day UTC Date objects
   * taking Daylight Saving Time (DST) into account dynamically via Intl API.
   */
  private getEgyptDayRange(businessDate: string): { startDate: Date; endDate: Date } {
    const [year, month, day] = businessDate.split('-').map(Number);
    const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(tempDate);
    const hourVal = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
    const offsetHours = hourVal - 12;

    const startDate = new Date(Date.UTC(year, month - 1, day, 0 - offsetHours, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day, 23 - offsetHours, 59, 59, 999));

    return { startDate, endDate };
  }

  async openDay(dto: OpenDailyClosingDto, currentUserId?: string) {
    Money.assertNonNegative(dto.openingBalance || 0, 'Opening Balance');

    const existing = await this.prisma.dailyClosing.findUnique({
      where: { businessDate: dto.businessDate },
    });

    if (existing) {
      throw new ConflictException(
        `Daily closing for business date [${dto.businessDate}] already exists (Current status: ${existing.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const closing = await tx.dailyClosing.create({
        data: {
          businessDate: dto.businessDate,
          openingBalance: dto.openingBalance || 0,
          status: DailyClosingStatus.OPEN,
          notes: dto.notes,
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'DailyClosing',
          entityId: closing.id,
          newData: closing,
          userId: currentUserId,
        },
        tx,
      );

      return closing;
    });
  }

  async closeDay(businessDate: string, dto: CloseDailyClosingDto, currentUserId?: string) {
    Money.assertNonNegative(dto.actualBalance, 'Actual Balance');

    const closing = await this.prisma.dailyClosing.findUnique({
      where: { businessDate },
    });

    if (!closing) {
      throw new NotFoundException(`No daily closing record found for date [${businessDate}]`);
    }

    if (closing.status === DailyClosingStatus.CLOSED) {
      throw new BadRequestException(`Business day [${businessDate}] is already closed`);
    }

    // Compute start and end of business date in Egypt Local Time (Africa/Cairo)
    const { startDate, endDate } = this.getEgyptDayRange(businessDate);

    const [sales, payments, expenses] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          saleDate: { gte: startDate, lte: endDate },
          status: { not: 'CANCELLED' },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          paymentDate: { gte: startDate, lte: endDate },
          isReversed: false,
        },
      }),
      this.prisma.expense.findMany({
        where: {
          expenseDate: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const totalSales = sales.reduce((acc, s) => Money.add(acc, s.total), 0);
    const totalPayments = payments.reduce((acc, p) => Money.add(acc, p.amount), 0);
    const totalExpenses = expenses.reduce((acc, e) => Money.add(acc, e.amount), 0);

    // Detailed breakdown by payment method
    const cashPayments = payments.filter((p) => p.paymentMethod === PaymentMethod.CASH).reduce((a, p) => Money.add(a, p.amount), 0);
    const bankPayments = payments.filter((p) => p.paymentMethod === PaymentMethod.BANK).reduce((a, p) => Money.add(a, p.amount), 0);
    const walletPayments = payments.filter((p) => p.paymentMethod === PaymentMethod.WALLET).reduce((a, p) => Money.add(a, p.amount), 0);

    const cashExpenses = expenses.filter((e) => e.paymentMethod === PaymentMethod.CASH).reduce((a, e) => Money.add(a, e.amount), 0);
    const bankExpenses = expenses.filter((e) => e.paymentMethod === PaymentMethod.BANK).reduce((a, e) => Money.add(a, e.amount), 0);
    const walletExpenses = expenses.filter((e) => e.paymentMethod === PaymentMethod.WALLET).reduce((a, e) => Money.add(a, e.amount), 0);

    const expectedCashBalance = Money.subtract(Money.add(closing.openingBalance, cashPayments), cashExpenses);

    // Expected physical cash drawer balance = opening + cashPayments - cashExpenses
    const expectedBalance = Money.subtract(
      Money.add(closing.openingBalance, totalPayments),
      totalExpenses,
    );
    const difference = Money.subtract(dto.actualBalance, expectedBalance);

    const breakdownNotes = `[Breakdown] Cash: +${cashPayments}/-${cashExpenses} (ExpCash: ${expectedCashBalance}) | Bank: +${bankPayments}/-${bankExpenses} | Wallet: +${walletPayments}/-${walletExpenses}`;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.dailyClosing.update({
        where: { businessDate },
        data: {
          closedAt: new Date(),
          totalSales,
          totalPayments,
          totalExpenses,
          expectedBalance,
          actualBalance: dto.actualBalance,
          difference,
          status: DailyClosingStatus.CLOSED,
          closedBy: currentUserId,
          notes: dto.notes ? `${closing.notes || ''} | ${breakdownNotes} | Closed: ${dto.notes}` : `${closing.notes || ''} | ${breakdownNotes}`,
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.DAILY_CLOSE,
          entityType: 'DailyClosing',
          entityId: updated.id,
          newData: {
            businessDate,
            expectedBalance,
            actualBalance: dto.actualBalance,
            difference,
            cashPayments,
            bankPayments,
            walletPayments,
          },
          userId: currentUserId,
        },
        tx,
      );

      return {
        ...updated,
        breakdown: {
          cashPayments,
          bankPayments,
          walletPayments,
          cashExpenses,
          bankExpenses,
          walletExpenses,
          expectedCashBalance,
        },
      };
    });
  }

  async reopenDay(businessDate: string, dto: ReopenDailyClosingDto, currentUserId?: string) {
    const closing = await this.prisma.dailyClosing.findUnique({
      where: { businessDate },
    });

    if (!closing) {
      throw new NotFoundException(`No daily closing record found for date [${businessDate}]`);
    }

    if (closing.status !== DailyClosingStatus.CLOSED) {
      throw new BadRequestException(`Business day [${businessDate}] is not in CLOSED state`);
    }

    return this.prisma.$transaction(async (tx) => {
      const reopened = await tx.dailyClosing.update({
        where: { businessDate },
        data: {
          status: DailyClosingStatus.REOPENED,
          notes: `${closing.notes || ''} | Reopened: ${dto.reason}`,
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.DAILY_REOPEN,
          entityType: 'DailyClosing',
          entityId: reopened.id,
          newData: { businessDate, reason: dto.reason },
          userId: currentUserId,
        },
        tx,
      );

      return reopened;
    });
  }

  async getClosingByDate(businessDate: string) {
    const closing = await this.prisma.dailyClosing.findUnique({
      where: { businessDate },
      include: {
        closer: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    if (!closing) {
      throw new NotFoundException(`No daily closing record for date [${businessDate}]`);
    }

    return closing;
  }

  async listClosings() {
    return this.prisma.dailyClosing.findMany({
      orderBy: { businessDate: 'desc' },
      take: 30,
      include: {
        closer: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });
  }
}
