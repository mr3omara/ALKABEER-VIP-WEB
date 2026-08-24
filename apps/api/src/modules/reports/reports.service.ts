import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LineStatus, Money, MonthlyChargeStatus } from '@alkabeer/shared';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerDebtReport(customerId?: string) {
    const whereCustomer: any = { deletedAt: null };
    if (customerId) whereCustomer.id = customerId;

    const customers = await this.prisma.customer.findMany({
      where: whereCustomer,
      include: {
        monthlyCharges: {
          where: {
            status: { in: [MonthlyChargeStatus.DUE, MonthlyChargeStatus.PARTIALLY_PAID] },
          },
          include: { line: true },
          orderBy: { dueDate: 'asc' },
        },
        sales: {
          where: {
            remaining: { gt: 0 },
            status: { not: 'CANCELLED' },
          },
          orderBy: { saleDate: 'desc' },
        },
      },
    });

    return customers
      .map((c) => {
        const unpaidChargesTotal = c.monthlyCharges.reduce(
          (acc, ch) => Money.add(acc, Money.subtract(ch.amount, ch.paidAmount)),
          0,
        );
        const unpaidSalesTotal = c.sales.reduce(
          (acc, s) => Money.add(acc, s.remaining),
          0,
        );
        const openingBalance = c.openingBalance || 0;
        const totalDebt = Money.add(openingBalance, Money.add(unpaidChargesTotal, unpaidSalesTotal));

        return {
          customer: {
            id: c.id,
            code: c.customerCode,
            name: c.name,
            phone: c.phone,
          },
          openingBalance,
          unpaidChargesTotal,
          unpaidSalesTotal,
          totalDebt,
          unpaidChargesCount: c.monthlyCharges.length,
          unpaidCharges: c.monthlyCharges.map((ch) => ({
            chargeId: ch.id,
            billingMonth: ch.billingMonth,
            dueDate: ch.dueDate,
            phoneNumber: ch.line.phoneNumber,
            amount: ch.amount,
            paidAmount: ch.paidAmount,
            remainingAmount: Money.subtract(ch.amount, ch.paidAmount),
            status: ch.status,
          })),
        };
      })
      .filter((r) => r.totalDebt > 0);
  }

  async getDashboardSummary() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const startDate = new Date(`${dateStr}T00:00:00.000Z`);
    const endDate = new Date(`${dateStr}T23:59:59.999Z`);

    const [
      totalCustomersCount,
      totalLinesCount,
      inStockLinesCount,
      activeLinesCount,
      soldLinesCount,
      totalCompaniesCount,
      totalPackagesCount,
      todaySales,
      todayPayments,
      customersWithDebts,
      treasuryAccounts,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { deletedAt: null } }),
      this.prisma.line.count(),
      this.prisma.line.count({ where: { status: LineStatus.IN_STOCK } }),
      this.prisma.line.count({ where: { status: { in: [LineStatus.ACTIVE, LineStatus.SOLD] } } }),
      this.prisma.line.count({ where: { status: LineStatus.SOLD } }),
      this.prisma.company.count(),
      this.prisma.package.count(),
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
      this.getCustomerDebtReport(),
      this.prisma.treasuryAccount.findMany(),
    ]);

    const todaySalesTotal = todaySales.reduce((acc, s) => Money.add(acc, s.total), 0);
    const todayPaymentsTotal = todayPayments.reduce((acc, p) => Money.add(acc, p.amount), 0);
    const totalOutstandingDebt = customersWithDebts.reduce((acc, c) => Money.add(acc, c.totalDebt), 0);
    const totalTreasuryBalance = treasuryAccounts.reduce(
      (acc, a) => Money.add(acc, a.currentBalance),
      0,
    );

    return {
      totalCustomersCount,
      activeCustomersCount: totalCustomersCount,
      totalLinesCount,
      inStockLinesCount,
      activeLinesCount,
      soldLinesCount,
      totalCompaniesCount,
      totalPackagesCount,
      totalOutstandingDebt,
      debtorsCount: customersWithDebts.length,
      todaySalesTotal,
      totalSalesToday: todaySalesTotal,
      todaySalesCount: todaySales.length,
      todayPaymentsTotal,
      totalPaymentsToday: todayPaymentsTotal,
      todayPaymentsCount: todayPayments.length,
      totalTreasuryBalance,
      accounts: treasuryAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currentBalance: a.currentBalance,
      })),
    };
  }
}
