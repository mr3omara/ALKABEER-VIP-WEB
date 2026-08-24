import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTreasuryAccountDto, TransferFundsDto } from './dto/treasury.dto';
import {
  AuditAction,
  Money,
  TreasuryDirection,
  TreasuryTransactionType,
} from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class TreasuryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createAccount(dto: CreateTreasuryAccountDto, currentUserId?: string) {
    Money.assertNonNegative(dto.openingBalance || 0, 'Opening Balance');

    const existing = await this.prisma.treasuryAccount.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Treasury account [${dto.name}] already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.treasuryAccount.create({
        data: {
          name: dto.name,
          type: dto.type,
          openingBalance: dto.openingBalance || 0,
          currentBalance: dto.openingBalance || 0,
        },
      });

      if ((dto.openingBalance || 0) > 0) {
        const txCount = await tx.treasuryTransaction.count();
        const transactionNumber = `TX-${(txCount + 10001).toString()}`;

        await tx.treasuryTransaction.create({
          data: {
            transactionNumber,
            transactionType: TreasuryTransactionType.OPENING_BALANCE,
            direction: TreasuryDirection.IN,
            amount: dto.openingBalance!,
            accountId: account.id,
            description: 'Opening balance setup',
            createdBy: currentUserId,
          },
        });
      }

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'TreasuryAccount',
          entityId: account.id,
          newData: account,
          userId: currentUserId,
        },
        tx,
      );

      return account;
    });
  }

  async getAccounts() {
    return this.prisma.treasuryAccount.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async transferFunds(dto: TransferFundsDto, currentUserId?: string) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Source and destination accounts must be different');
    }

    Money.assertPositive(dto.amount, 'Transfer Amount');

    const fromAccount = await this.prisma.treasuryAccount.findUnique({
      where: { id: dto.fromAccountId },
    });
    const toAccount = await this.prisma.treasuryAccount.findUnique({
      where: { id: dto.toAccountId },
    });

    if (!fromAccount || !toAccount) {
      throw new NotFoundException('One or both treasury accounts not found');
    }

    if (fromAccount.currentBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient funds in account [${fromAccount.name}]. Available: ${fromAccount.currentBalance} EGP, Requested: ${dto.amount} EGP`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const txCount = await tx.treasuryTransaction.count();
      const txOutNumber = `TX-${(txCount + 10001).toString()}`;
      const txInNumber = `TX-${(txCount + 10002).toString()}`;

      // Outflow transaction from source account
      await tx.treasuryTransaction.create({
        data: {
          transactionNumber: txOutNumber,
          transactionType: TreasuryTransactionType.TRANSFER,
          direction: TreasuryDirection.OUT,
          amount: dto.amount,
          accountId: fromAccount.id,
          description: `Transfer to [${toAccount.name}]: ${dto.description || ''}`,
          createdBy: currentUserId,
        },
      });

      // Inflow transaction to destination account
      await tx.treasuryTransaction.create({
        data: {
          transactionNumber: txInNumber,
          transactionType: TreasuryTransactionType.TRANSFER,
          direction: TreasuryDirection.IN,
          amount: dto.amount,
          accountId: toAccount.id,
          description: `Transfer from [${fromAccount.name}]: ${dto.description || ''}`,
          createdBy: currentUserId,
        },
      });

      // Update balances in whole EGP
      await tx.treasuryAccount.update({
        where: { id: fromAccount.id },
        data: {
          currentBalance: Money.subtract(fromAccount.currentBalance, dto.amount),
        },
      });

      await tx.treasuryAccount.update({
        where: { id: toAccount.id },
        data: {
          currentBalance: Money.add(toAccount.currentBalance, dto.amount),
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'TreasuryTransfer',
          newData: {
            fromAccount: fromAccount.name,
            toAccount: toAccount.name,
            amount: dto.amount,
          },
          userId: currentUserId,
        },
        tx,
      );

      return { success: true, amount: dto.amount };
    });
  }

  async getTransactions(
    pagination: PaginationDto,
    accountId?: string,
    transactionType?: TreasuryTransactionType,
    direction?: TreasuryDirection,
  ) {
    const where: any = {};
    if (accountId) where.accountId = accountId;
    if (transactionType) where.transactionType = transactionType;
    if (direction) where.direction = direction;

    const [items, totalItems] = await Promise.all([
      this.prisma.treasuryTransaction.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          treasuryAccount: true,
          creator: {
            select: { id: true, username: true, fullName: true },
          },
        },
      }),
      this.prisma.treasuryTransaction.count({ where }),
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
}
