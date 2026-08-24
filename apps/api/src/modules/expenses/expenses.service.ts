import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseCategoryDto, CreateExpenseDto } from './dto/expense.dto';
import {
  AuditAction,
  Money,
  PaymentMethod,
  TreasuryDirection,
  TreasuryTransactionType,
} from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createCategory(dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Expense category [${dto.name}] already exists`);
    }

    return this.prisma.expenseCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async getCategories() {
    return this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createExpense(dto: CreateExpenseDto, currentUserId?: string) {
    Money.assertPositive(dto.amount, 'Expense Amount');

    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Expense category not found');
    }

    const treasuryAccount = await this.prisma.treasuryAccount.findUnique({
      where: { id: dto.treasuryAccountId },
    });
    if (!treasuryAccount || treasuryAccount.status !== 'ACTIVE') {
      throw new BadRequestException('Selected treasury account is invalid or inactive');
    }

    if (treasuryAccount.currentBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient treasury balance in [${treasuryAccount.name}]. Available: ${treasuryAccount.currentBalance} EGP, Expense: ${dto.amount} EGP`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const expenseCount = await tx.expense.count();
      const expenseNumber = `EXP-${(expenseCount + 10001).toString()}`;

      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          categoryId: category.id,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          treasuryAccountId: treasuryAccount.id,
          description: dto.description,
          createdBy: currentUserId,
        },
      });

      const txCount = await tx.treasuryTransaction.count();
      const transactionNumber = `TX-${(txCount + 10001).toString()}`;

      await tx.treasuryTransaction.create({
        data: {
          transactionNumber,
          transactionType: TreasuryTransactionType.EXPENSE,
          direction: TreasuryDirection.OUT,
          amount: dto.amount,
          accountId: treasuryAccount.id,
          expenseId: expense.id,
          description: `Expense ${expense.expenseNumber}: ${dto.description}`,
          createdBy: currentUserId,
        },
      });

      // Deduct from treasury account in whole EGP
      await tx.treasuryAccount.update({
        where: { id: treasuryAccount.id },
        data: {
          currentBalance: Money.subtract(treasuryAccount.currentBalance, dto.amount),
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'Expense',
          entityId: expense.id,
          newData: {
            expenseNumber: expense.expenseNumber,
            amount: dto.amount,
            category: category.name,
            account: treasuryAccount.name,
          },
          userId: currentUserId,
        },
        tx,
      );

      return this.findOne(expense.id, tx);
    });
  }

  async findMany(pagination: PaginationDto, categoryId?: string) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;

    if (pagination.search) {
      where.OR = [
        { expenseNumber: { contains: pagination.search, mode: 'insensitive' } },
        { description: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { expenseDate: 'desc' },
        include: {
          category: true,
          treasuryAccount: true,
          creator: {
            select: { id: true, username: true, fullName: true },
          },
        },
      }),
      this.prisma.expense.count({ where }),
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
    const expense = await client.expense.findUnique({
      where: { id },
      include: {
        category: true,
        treasuryAccount: true,
        treasuryTransactions: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }
}
