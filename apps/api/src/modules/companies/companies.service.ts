import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AuditAction, Money, TreasuryDirection, TreasuryTransactionType, PaymentMethod } from '@alkabeer/shared';

@Injectable()
export class CompaniesService implements OnModuleInit {
  private readonly logger = new Logger(CompaniesService.name);
  private readonly storageFile = path.resolve(process.cwd(), 'backups', 'company_liabilities.json');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.migrateJsonLiabilitiesToDatabase();
  }

  /**
   * One-time automated migration of legacy JSON liabilities to PostgreSQL
   */
  private async migrateJsonLiabilitiesToDatabase() {
    try {
      if (!fs.existsSync(this.storageFile)) return;
      const content = fs.readFileSync(this.storageFile, 'utf-8');
      const items = JSON.parse(content || '[]');
      if (!Array.isArray(items) || items.length === 0) return;

      this.logger.log(`Migrating ${items.length} legacy JSON company liabilities to PostgreSQL database...`);

      for (const item of items) {
        if (!item.companyId || !item.billingMonth) continue;
        const companyExists = await this.prisma.company.findUnique({ where: { id: item.companyId } });
        if (!companyExists) continue;

        const existing = await this.prisma.companyLiability.findFirst({
          where: {
            companyId: item.companyId,
            billingMonth: item.billingMonth,
          },
        });

        if (!existing) {
          await this.prisma.companyLiability.create({
            data: {
              invoiceNumber: item.invoiceNumber || `INV-${item.companyCode}-${item.billingMonth.replace('-', '')}`,
              companyId: item.companyId,
              billingMonth: item.billingMonth,
              dueDate: new Date(item.dueDate || new Date()),
              amount: item.amount || 0,
              paidAmount: item.paidAmount || 0,
              remainingAmount: item.remainingAmount !== undefined ? item.remainingAmount : (item.amount - (item.paidAmount || 0)),
              status: item.status || 'UNPAID',
              alertStatus: item.alertStatus || 'NORMAL',
              notes: item.notes || null,
              createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            },
          });
        }
      }

      // Rename JSON file so it won't be re-migrated
      const migratedFile = `${this.storageFile}.migrated`;
      fs.renameSync(this.storageFile, migratedFile);
      this.logger.log(`Successfully migrated legacy JSON liabilities to database. Archived to ${migratedFile}`);
    } catch (err: any) {
      this.logger.error(`Error during company liabilities JSON migration: ${err?.message || err}`);
    }
  }

  async create(dto: CreateCompanyDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.company.findFirst({
      where: {
        OR: [{ name: dto.name }, { code }],
      },
    });

    if (existing) {
      throw new ConflictException('شركة اتصالات بنفس الاسم أو الكود موجودة مسبقاً');
    }

    const paymentDay = dto.renewalDate
      ? new Date(dto.renewalDate).getDate() || 1
      : (dto.paymentDay || 1);

    return this.prisma.company.create({
      data: {
        name: dto.name,
        code,
        color: dto.color,
        paymentDay,
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
        sponsorName: dto.sponsorName?.trim() || null,
        sponsorPhone: dto.sponsorPhone?.trim() || null,
        accountManagerName: dto.accountManagerName?.trim() || null,
        accountManagerPhone: dto.accountManagerPhone?.trim() || null,
        contractNumber: dto.contractNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: dto.status || 'ACTIVE',
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('شركة الاتصالات غير موجودة');
    }

    if (dto.name && dto.name !== company.name) {
      const nameExists = await this.prisma.company.findUnique({ where: { name: dto.name } });
      if (nameExists) throw new ConflictException('يوجد شركة اتصالات أخرى مسجلة بنفس الاسم');
    }

    if (dto.code && dto.code.trim().toUpperCase() !== company.code) {
      const codeExists = await this.prisma.company.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
      if (codeExists) throw new ConflictException('يوجد شركة اتصالات أخرى مسجلة بنفس الكود');
    }

    const paymentDay = dto.renewalDate
      ? new Date(dto.renewalDate).getDate() || company.paymentDay
      : (dto.paymentDay !== undefined ? dto.paymentDay : company.paymentDay);

    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        color: dto.color,
        paymentDay,
        renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : undefined,
        sponsorName: dto.sponsorName !== undefined ? (dto.sponsorName.trim() || null) : undefined,
        sponsorPhone: dto.sponsorPhone !== undefined ? (dto.sponsorPhone.trim() || null) : undefined,
        accountManagerName: dto.accountManagerName !== undefined ? (dto.accountManagerName.trim() || null) : undefined,
        accountManagerPhone: dto.accountManagerPhone !== undefined ? (dto.accountManagerPhone.trim() || null) : undefined,
        contractNumber: dto.contractNumber !== undefined ? (dto.contractNumber.trim() || null) : undefined,
        notes: dto.notes !== undefined ? (dto.notes.trim() || null) : undefined,
        status: dto.status,
      },
    });
  }

  async remove(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { lines: true, liabilities: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('شركة الاتصالات غير موجودة');
    }

    if (company._count.lines > 0) {
      throw new BadRequestException(`لا يمكن حذف شركة اتصالات مرتبطة بـ (${company._count.lines}) خط بالمخزن`);
    }

    return this.prisma.company.delete({
      where: { id },
    });
  }

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        _count: {
          select: { lines: true, liabilities: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { lines: true, liabilities: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  // ----------------------------------------------------
  // B2B COMPANY LIABILITIES & INVOICES PIPELINE (POSTGRESQL)
  // ----------------------------------------------------

  async getLiabilities(statusFilter?: string, search?: string) {
    const where: any = {};
    if (statusFilter) {
      where.status = statusFilter;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
        { company: { code: { contains: search, mode: 'insensitive' } } },
        { billingMonth: { contains: search, mode: 'insensitive' } },
      ];
    }

    const rawLiabilities = await this.prisma.companyLiability.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        company: true,
        installments: {
          include: { treasuryAccount: true, creator: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = new Date();
    const formattedLiabilities = rawLiabilities.map((item) => {
      const due = new Date(item.dueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));

      let alertStatus: 'OVERDUE' | 'DUE_SOON' | 'NORMAL' = 'NORMAL';
      if (item.status !== 'PAID') {
        if (diffDays < 0) {
          alertStatus = 'OVERDUE';
        } else if (diffDays <= 5) {
          alertStatus = 'DUE_SOON';
        }
      }

      return {
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        companyId: item.companyId,
        companyName: item.company?.name || '',
        companyCode: item.company?.code || '',
        companyColor: item.company?.color || '#0A192F',
        billingMonth: item.billingMonth,
        dueDate: item.dueDate.toISOString().split('T')[0],
        amount: item.amount,
        paidAmount: item.paidAmount,
        remainingAmount: item.remainingAmount,
        status: item.status as any,
        alertStatus,
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
        installments: item.installments,
      };
    });

    const totalOutstanding = formattedLiabilities.reduce((acc, i) => acc + i.remainingAmount, 0);
    const currentMonthPrefix = now.toISOString().slice(0, 7);
    const paidThisMonth = formattedLiabilities.reduce((acc, i) => {
      if (i.createdAt.startsWith(currentMonthPrefix) || i.status === 'PAID') {
        return acc + i.paidAmount;
      }
      return acc;
    }, 0);
    const pendingCount = formattedLiabilities.filter((i) => i.status !== 'PAID').length;

    return {
      items: formattedLiabilities,
      summary: {
        totalOutstanding,
        paidThisMonth,
        pendingCount,
        totalCount: formattedLiabilities.length,
      },
    };
  }

  async createLiability(
    dto: {
      companyId: string;
      billingMonth: string;
      dueDate: string;
      amount: number;
      notes?: string;
    },
    userId?: string,
  ) {
    if (!dto.companyId || !dto.billingMonth || !dto.dueDate || !dto.amount || dto.amount <= 0) {
      throw new BadRequestException('يرجى إدخال كافة بيانات الفاتورة بشكل صحيح');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('شركة الاتصالات غير موجودة');
    }

    const count = await this.prisma.companyLiability.count();
    const invoiceNumber = `INV-${company.code}-${dto.billingMonth.replace('-', '')}-${(count + 101).toString()}`;

    const liability = await this.prisma.companyLiability.create({
      data: {
        invoiceNumber,
        companyId: company.id,
        billingMonth: dto.billingMonth,
        dueDate: new Date(dto.dueDate),
        amount: dto.amount,
        paidAmount: 0,
        remainingAmount: dto.amount,
        status: 'UNPAID',
        alertStatus: 'NORMAL',
        notes: dto.notes,
      },
      include: { company: true },
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      entityType: 'CompanyLiability',
      entityId: liability.id,
      newData: liability,
      userId,
    });

    return {
      ...liability,
      companyName: company.name,
      companyCode: company.code,
      companyColor: company.color || '#0A192F',
      dueDate: liability.dueDate.toISOString().split('T')[0],
      createdAt: liability.createdAt.toISOString(),
    };
  }

  async payLiabilityInstallment(
    id: string,
    dto: {
      amount: number;
      treasuryAccountId: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
    },
    userId?: string,
  ) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('مبلغ السداد يجب أن يكون أكبر من صفر');
    }

    const treasuryAccount = await this.prisma.treasuryAccount.findUnique({
      where: { id: dto.treasuryAccountId },
    });

    if (!treasuryAccount || treasuryAccount.status !== 'ACTIVE') {
      throw new BadRequestException('الحساب المالي / الخزينة غير صالحة');
    }

    if (treasuryAccount.currentBalance < dto.amount) {
      throw new BadRequestException(`رصيد الخزينة الحقيقي (${Money.format(treasuryAccount.currentBalance)} ج.م) لا يكفي لخصم المبلغ`);
    }

    return this.prisma.$transaction(async (tx) => {
      const liability = await tx.companyLiability.findUnique({
        where: { id },
        include: { company: true },
      });

      if (!liability) {
        throw new NotFoundException('فاتورة / التزام الشركة غير موجود');
      }

      if (liability.status === 'PAID' || liability.remainingAmount <= 0) {
        throw new BadRequestException('هذه الفاتورة مسددة بالكامل بالفعل');
      }

      if (dto.amount > liability.remainingAmount) {
        throw new BadRequestException(`مبلغ السداد أكبر من المتبقي على الفاتورة (${Money.format(liability.remainingAmount)} ج.م)`);
      }

      // Deduct from treasury account
      await tx.treasuryAccount.update({
        where: { id: treasuryAccount.id },
        data: {
          currentBalance: { decrement: dto.amount },
        },
      });

      const txCount = await tx.treasuryTransaction.count();
      const transactionNumber = `TX-OUT-${(txCount + 10001).toString()}`;

      await tx.treasuryTransaction.create({
        data: {
          transactionNumber,
          accountId: treasuryAccount.id,
          amount: dto.amount,
          direction: TreasuryDirection.OUT,
          transactionType: TreasuryTransactionType.EXPENSE,
          description: `سداد فاتورة شركة ${liability.company.name} (${liability.invoiceNumber}) — شهر ${liability.billingMonth}`,
          createdBy: userId,
        },
      });

      // Record installment
      await tx.companyLiabilityInstallment.create({
        data: {
          liabilityId: liability.id,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          treasuryAccountId: treasuryAccount.id,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      // Update Liability record
      const newPaidAmount = Money.add(liability.paidAmount, dto.amount);
      const newRemainingAmount = Money.subtract(liability.amount, newPaidAmount);
      const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

      const updatedLiability = await tx.companyLiability.update({
        where: { id: liability.id },
        data: {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        },
        include: { company: true, installments: true },
      });

      await this.auditService.record(
        {
          action: AuditAction.UPDATE,
          entityType: 'CompanyLiabilityPayment',
          entityId: liability.id,
          newData: {
            paidInstallment: dto.amount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
            treasuryAccountId: dto.treasuryAccountId,
          },
          userId,
        },
        tx,
      );

      return {
        ...updatedLiability,
        companyName: updatedLiability.company.name,
        companyCode: updatedLiability.company.code,
        companyColor: updatedLiability.company.color || '#0A192F',
        dueDate: updatedLiability.dueDate.toISOString().split('T')[0],
        createdAt: updatedLiability.createdAt.toISOString(),
      };
    });
  }

  async deleteLiability(id: string, userId?: string) {
    const liability = await this.prisma.companyLiability.findUnique({
      where: { id },
    });

    if (!liability) {
      throw new NotFoundException('التزام الشركة غير موجود');
    }

    await this.prisma.companyLiability.delete({
      where: { id },
    });

    await this.auditService.record({
      action: AuditAction.DELETE,
      entityType: 'CompanyLiability',
      entityId: id,
      userId,
    });

    return { success: true };
  }
}
