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
import { AuditAction, DailyClosingStatus, Money } from '@alkabeer/shared';

@Injectable()
export class DailyClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

    // Compute start and end of business date in UTC
    const startDate = new Date(`${businessDate}T00:00:00.000Z`);
    const endDate = new Date(`${businessDate}T23:59:59.999Z`);

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

    // Expected physical balance = opening + payments - expenses
    const expectedBalance = Money.subtract(
      Money.add(closing.openingBalance, totalPayments),
      totalExpenses,
    );
    const difference = Money.subtract(dto.actualBalance, expectedBalance);

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
          notes: dto.notes ? `${closing.notes || ''} | Closed: ${dto.notes}` : closing.notes,
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
          },
          userId: currentUserId,
        },
        tx,
      );

      return updated;
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
