import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getLedgerEntries(
    pagination: PaginationDto & {
      customerId?: string;
      transactionType?: string;
      dateFrom?: string;
      dateTo?: string;
      direction?: 'DEBIT' | 'CREDIT';
      search?: string;
    },
  ) {
    const where: any = {};

    if (pagination.customerId) {
      where.customerId = pagination.customerId;
    }
    if (pagination.transactionType) {
      where.transactionType = pagination.transactionType;
    }
    if (pagination.direction === 'DEBIT') {
      where.debit = { gt: 0 };
    } else if (pagination.direction === 'CREDIT') {
      where.credit = { gt: 0 };
    }

    if (pagination.dateFrom || pagination.dateTo) {
      where.transactionDate = {};
      if (pagination.dateFrom) {
        where.transactionDate.gte = new Date(pagination.dateFrom);
      }
      if (pagination.dateTo) {
        where.transactionDate.lte = new Date(pagination.dateTo);
      }
    }

    if (pagination.search) {
      where.OR = [
        { transactionNumber: { contains: pagination.search, mode: 'insensitive' } },
        { description: { contains: pagination.search, mode: 'insensitive' } },
        { customer: { name: { contains: pagination.search, mode: 'insensitive' } } },
        { customer: { customerCode: { contains: pagination.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: pagination.search, mode: 'insensitive' } } },
      ];
    }

    const [items, totalItems, totals] = await Promise.all([
      this.prisma.customerLedger.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              customerCode: true,
              phone: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.customerLedger.count({ where }),
      this.prisma.customerLedger.aggregate({
        where,
        _sum: {
          debit: true,
          credit: true,
        },
      }),
    ]);

    return {
      items,
      totals: {
        totalDebit: totals._sum.debit || 0,
        totalCredit: totals._sum.credit || 0,
        netBalance: (totals._sum.debit || 0) - (totals._sum.credit || 0),
      },
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.limit),
      },
    };
  }

  async getCustomerStatement(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const ledgerEntries = await this.prisma.customerLedger.findMany({
      where: { customerId },
      orderBy: { transactionDate: 'asc' },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Re-verify running balance consistency
    let runningBalance = customer.openingBalance;
    const verifiedEntries = ledgerEntries.map((entry: any) => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance,
      };
    });

    return {
      customer: {
        id: customer.id,
        customerCode: customer.customerCode,
        name: customer.name,
        phone: customer.phone,
        cachedBalance: customer.cachedBalance,
        openingBalance: customer.openingBalance,
      },
      ledgerEntries: verifiedEntries,
      finalBalance: customer.cachedBalance,
    };
  }
}
