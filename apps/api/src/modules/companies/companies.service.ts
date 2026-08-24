import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AuditAction, Money, TreasuryDirection, TreasuryTransactionType, PaymentMethod } from '@alkabeer/shared';

export interface CompanyLiability {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  companyColor?: string;
  billingMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  alertStatus: 'OVERDUE' | 'DUE_SOON' | 'NORMAL';
  notes?: string;
  createdAt: string;
}

@Injectable()
export class CompaniesService {
  private readonly storageFile = path.resolve(process.cwd(), 'backups', 'company_liabilities.json');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.ensureStorageExists();
  }

  private ensureStorageExists() {
    const dir = path.dirname(this.storageFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.storageFile)) {
      fs.writeFileSync(this.storageFile, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  private readLiabilitiesFromDisk(): CompanyLiability[] {
    try {
      this.ensureStorageExists();
      const content = fs.readFileSync(this.storageFile, 'utf-8');
      return JSON.parse(content || '[]');
    } catch {
      return [];
    }
  }

  private writeLiabilitiesToDisk(data: CompanyLiability[]) {
    this.ensureStorageExists();
    fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
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
          select: { lines: true },
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
          select: { lines: true },
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
          select: { lines: true },
        },
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  // ----------------------------------------------------
  // B2B COMPANY LIABILITIES & INVOICES PIPELINE
  // ----------------------------------------------------

  async getLiabilities(statusFilter?: string, search?: string) {
    const list = this.readLiabilitiesFromDisk();
    const now = new Date();

    // Recalculate alert statuses live
    const updatedList = list.map((item) => {
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
        ...item,
        alertStatus,
      };
    });

    let filtered = updatedList;

    if (statusFilter) {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (i) =>
          i.companyName.toLowerCase().includes(q) ||
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.billingMonth.includes(q) ||
          (i.notes && i.notes.toLowerCase().includes(q)),
      );
    }

    // KPI Metrics calculation
    const totalOutstanding = updatedList.reduce((acc, i) => acc + i.remainingAmount, 0);

    const currentMonthPrefix = now.toISOString().slice(0, 7);
    const paidThisMonth = updatedList.reduce((acc, i) => {
      if (i.createdAt.startsWith(currentMonthPrefix) || i.status === 'PAID') {
        return acc + i.paidAmount;
      }
      return acc;
    }, 0);

    const pendingCount = updatedList.filter((i) => i.status !== 'PAID').length;

    return {
      items: filtered,
      summary: {
        totalOutstanding,
        paidThisMonth,
        pendingCount,
        totalCount: updatedList.length,
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

    const list = this.readLiabilitiesFromDisk();
    const invoiceNumber = `INV-${company.code}-${dto.billingMonth.replace('-', '')}-${(list.length + 101).toString()}`;

    const newLiability: CompanyLiability = {
      id: `liab-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      invoiceNumber,
      companyId: company.id,
      companyName: company.name,
      companyCode: company.code,
      companyColor: company.color || '#0A192F',
      billingMonth: dto.billingMonth,
      dueDate: dto.dueDate,
      amount: dto.amount,
      paidAmount: 0,
      remainingAmount: dto.amount,
      status: 'UNPAID',
      alertStatus: 'NORMAL',
      notes: dto.notes,
      createdAt: new Date().toISOString(),
    };

    list.unshift(newLiability);
    this.writeLiabilitiesToDisk(list);

    await this.auditService.record({
      action: AuditAction.CREATE,
      entityType: 'CompanyLiability',
      entityId: newLiability.id,
      newData: newLiability,
      userId,
    });

    return newLiability;
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

    const list = this.readLiabilitiesFromDisk();
    const index = list.findIndex((i) => i.id === id);

    if (index === -1) {
      throw new NotFoundException('فاتورة / التزام الشركة غير موجود');
    }

    const item = list[index];
    if (item.status === 'PAID' || item.remainingAmount <= 0) {
      throw new BadRequestException('هذه الفاتورة مسددة بالكامل بالفعل');
    }

    if (dto.amount > item.remainingAmount) {
      throw new BadRequestException(`مبلغ السداد أكبر من المتبقي على الفاتورة (${Money.format(item.remainingAmount)} ج.م)`);
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

    // Execute atomic Treasury OUT deduction
    await this.prisma.$transaction(async (tx) => {
      // 1. Deduct from treasury account
      await tx.treasuryAccount.update({
        where: { id: treasuryAccount.id },
        data: {
          currentBalance: { decrement: dto.amount },
        },
      });

      const txCount = await tx.treasuryTransaction.count();
      const transactionNumber = `TX-OUT-${(txCount + 10001).toString()}`;

      // 2. Record Treasury OUT transaction
      await tx.treasuryTransaction.create({
        data: {
          transactionNumber,
          accountId: treasuryAccount.id,
          amount: dto.amount,
          direction: TreasuryDirection.OUT,
          transactionType: TreasuryTransactionType.EXPENSE,
          description: `سداد فاتورة شركة ${item.companyName} (${item.invoiceNumber}) — شهر ${item.billingMonth}`,
          createdBy: userId,
        },
      });
    });

    // Update Liability record
    const newPaidAmount = item.paidAmount + dto.amount;
    const newRemainingAmount = item.amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    list[index] = {
      ...item,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      status: newStatus,
    };

    this.writeLiabilitiesToDisk(list);

    await this.auditService.record({
      action: AuditAction.UPDATE,
      entityType: 'CompanyLiabilityPayment',
      entityId: item.id,
      newData: {
        paidInstallment: dto.amount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        treasuryAccountId: dto.treasuryAccountId,
      },
      userId,
    });

    return list[index];
  }

  async deleteLiability(id: string, userId?: string) {
    const list = this.readLiabilitiesFromDisk();
    const filtered = list.filter((i) => i.id !== id);

    if (list.length === filtered.length) {
      throw new NotFoundException('التزام الشركة غير موجود');
    }

    this.writeLiabilitiesToDisk(filtered);

    await this.auditService.record({
      action: AuditAction.DELETE,
      entityType: 'CompanyLiability',
      entityId: id,
      userId,
    });

    return { success: true };
  }
}
