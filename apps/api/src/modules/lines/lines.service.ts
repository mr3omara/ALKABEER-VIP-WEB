import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLineDto, CreateBulkLinesDto, UpdateLineDto } from './dto/line.dto';
import {
  AuditAction,
  InventoryMovementType,
  LineStatus,
  Money,
} from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class LinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateLineDto, currentUserId?: string) {
    // Assert all financial figures are pure integers
    Money.assertNonNegative(dto.monthlyPackage || 0, 'Monthly Package');
    Money.assertNonNegative(dto.additionalPackage || 0, 'Additional Package');
    Money.assertNonNegative(dto.purchasePrice || 0, 'Purchase Price');
    Money.assertNonNegative(dto.salePrice || 0, 'Sale Price');

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException('Telecom company not found');
    }

    const existing = await this.prisma.line.findUnique({
      where: { phoneNumber: dto.phoneNumber },
    });
    if (existing) {
      throw new ConflictException(`Line with phone number [${dto.phoneNumber}] already exists`);
    }

    const calculatedPaymentDay = dto.renewalDate
      ? new Date(dto.renewalDate).getDate() || 1
      : (dto.paymentDay || company.paymentDay || 1);

    return this.prisma.$transaction(async (tx) => {
      const line = await tx.line.create({
        data: {
          phoneNumber: dto.phoneNumber,
          companyId: dto.companyId,
          monthlyPackage: dto.monthlyPackage || 0,
          additionalPackage: dto.additionalPackage || 0,
          renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
          paymentDay: calculatedPaymentDay,
          purchasePrice: dto.purchasePrice || 0,
          salePrice: dto.salePrice || 0,
          status: LineStatus.IN_STOCK,
          notes: dto.notes,
        },
      });

      // Immutable inventory movement
      await tx.inventoryMovement.create({
        data: {
          lineId: line.id,
          movementType: InventoryMovementType.PURCHASE,
          quantity: 1,
          referenceType: 'LINE_CREATE',
          referenceId: line.id,
          notes: 'Initial stock intake',
          createdBy: currentUserId,
        },
      });

      // Line history
      await tx.lineHistory.create({
        data: {
          lineId: line.id,
          action: 'CREATE',
          oldStatus: 'NONE',
          newStatus: LineStatus.IN_STOCK,
          referenceType: 'INITIAL_STOCK',
          referenceId: line.id,
          notes: 'Line created in inventory',
          createdBy: currentUserId,
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'Line',
          entityId: line.id,
          newData: line,
          userId: currentUserId,
        },
        tx,
      );

      return line;
    });
  }

  async createBulk(dto: CreateBulkLinesDto, currentUserId?: string) {
    const rawNumbers = Array.isArray(dto.phoneNumbers) ? dto.phoneNumbers : [];
    const validNumbers = Array.from(
      new Set(
        rawNumbers
          .map((n) => {
            const cleaned = (n || '').replace(/\D/g, '');
            if (cleaned.length === 10) return '0' + cleaned;
            if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned;
            return null;
          })
          .filter((n): n is string => !!n),
      ),
    );

    if (validNumbers.length === 0) {
      throw new BadRequestException('لم يتم العثور على أرقام هواتف صالحة للمعالجة');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException('شركة الاتصالات غير موجودة');
    }

    const existingLines = await this.prisma.line.findMany({
      where: { phoneNumber: { in: validNumbers } },
      select: { phoneNumber: true },
    });
    const existingSet = new Set(existingLines.map((l) => l.phoneNumber));
    const toCreateNumbers = validNumbers.filter((num) => !existingSet.has(num));

    if (toCreateNumbers.length === 0) {
      throw new ConflictException('جميع الأرقام المدخلة مسجلة مسبقاً في النظام');
    }

    const calculatedPaymentDay = dto.renewalDate
      ? new Date(dto.renewalDate).getDate() || 1
      : (dto.paymentDay || company.paymentDay || 1);

    const createdLines = await this.prisma.$transaction(async (tx) => {
      const inserted = [];
      for (const phone of toCreateNumbers) {
        const line = await tx.line.create({
          data: {
            phoneNumber: phone,
            companyId: dto.companyId,
            monthlyPackage: dto.monthlyPackage || 0,
            additionalPackage: 0,
            paymentDay: calculatedPaymentDay,
            purchasePrice: dto.purchasePrice || 0,
            salePrice: dto.salePrice || 0,
            status: LineStatus.IN_STOCK,
            notes: dto.notes?.trim() || undefined,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            lineId: line.id,
            movementType: InventoryMovementType.PURCHASE,
            quantity: 1,
            referenceType: 'BULK_STOCK_INTAKE',
            referenceId: line.id,
            notes: dto.notes?.trim() || 'Bulk stock intake',
            createdBy: currentUserId,
          },
        });

        await tx.lineHistory.create({
          data: {
            lineId: line.id,
            action: 'CREATE',
            oldStatus: 'NONE',
            newStatus: LineStatus.IN_STOCK,
            referenceType: 'INITIAL_STOCK',
            referenceId: line.id,
            notes: 'Line created via bulk stock intake',
            createdBy: currentUserId,
          },
        });

        inserted.push(line);
      }
      return inserted;
    });

    return {
      createdCount: createdLines.length,
      skippedCount: existingLines.length,
      skippedNumbers: existingLines.map((l) => l.phoneNumber),
      lines: createdLines,
    };
  }

  async findMany(
    pagination: PaginationDto,
    companyId?: string,
    status?: LineStatus,
    customerId?: string,
    monthlyPackage?: number,
  ) {
    const where: any = {};
    if (companyId && typeof companyId === 'string' && companyId.trim() !== '') {
      where.companyId = companyId.trim();
    }
    if (status && typeof status === 'string' && (status as string).trim() !== '') {
      where.status = status;
    }
    if (customerId && typeof customerId === 'string' && customerId.trim() !== '') {
      where.customerId = customerId.trim();
    }
    if (monthlyPackage !== undefined && monthlyPackage !== null && !isNaN(Number(monthlyPackage))) {
      where.monthlyPackage = Number(monthlyPackage);
    }

    if (pagination.search && pagination.search.trim() !== '') {
      const searchClean = pagination.search.trim();
      where.OR = [
        { phoneNumber: { contains: searchClean } },
        { notes: { contains: searchClean, mode: 'insensitive' } },
        { customer: { name: { contains: searchClean, mode: 'insensitive' } } },
        { customer: { customerCode: { contains: searchClean, mode: 'insensitive' } } },
        { company: { name: { contains: searchClean, mode: 'insensitive' } } },
      ];
    }

    const [items, totalItems, inStockCount, reservedCount, soldCount, financialSums] = await Promise.all([
      this.prisma.line.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
          customer: {
            select: { id: true, name: true, phone: true, customerCode: true },
          },
        },
      }),
      this.prisma.line.count({ where }),
      this.prisma.line.count({ where: { status: LineStatus.IN_STOCK } }),
      this.prisma.line.count({ where: { status: LineStatus.RESERVED } }),
      this.prisma.line.count({ where: { status: { in: [LineStatus.SOLD, LineStatus.ACTIVE] } } }),
      this.prisma.line.aggregate({
        _sum: {
          purchasePrice: true,
          salePrice: true,
          monthlyPackage: true,
        },
      }),
    ]);

    const totalCost = financialSums._sum.purchasePrice || 0;
    const totalSelling = (financialSums._sum.salePrice || 0) > 0 ? financialSums._sum.salePrice || 0 : financialSums._sum.monthlyPackage || 0;
    const expectedProfit = totalSelling - totalCost;

    return {
      items,
      summary: {
        totalLines: totalItems,
        inStockLines: inStockCount,
        reservedLines: reservedCount,
        soldLines: soldCount,
        totalCost,
        totalSelling,
        expectedProfit,
      },
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
    const line = await this.prisma.line.findUnique({
      where: { id },
      include: {
        company: true,
        customer: true,
        lineHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        inventoryMovements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        monthlyCharges: {
          orderBy: { dueDate: 'desc' },
          take: 12,
        },
      },
    });

    if (!line) {
      throw new NotFoundException('Line not found');
    }

    return line;
  }

  async update(id: string, dto: UpdateLineDto, currentUserId?: string) {
    const line = await this.prisma.line.findUnique({ where: { id } });
    if (!line) {
      throw new NotFoundException('Line not found');
    }

    if (dto.monthlyPackage !== undefined) Money.assertNonNegative(dto.monthlyPackage, 'Monthly Package');
    if (dto.additionalPackage !== undefined) Money.assertNonNegative(dto.additionalPackage, 'Additional Package');
    if (dto.purchasePrice !== undefined) Money.assertNonNegative(dto.purchasePrice, 'Purchase Price');
    if (dto.salePrice !== undefined) Money.assertNonNegative(dto.salePrice, 'Sale Price');

    const calculatedPaymentDay = dto.renewalDate
      ? new Date(dto.renewalDate).getDate() || 1
      : dto.paymentDay;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.line.update({
        where: { id },
        data: {
          monthlyPackage: dto.monthlyPackage,
          additionalPackage: dto.additionalPackage,
          renewalDate: dto.renewalDate !== undefined ? (dto.renewalDate ? new Date(dto.renewalDate) : null) : undefined,
          paymentDay: calculatedPaymentDay,
          purchasePrice: dto.purchasePrice,
          salePrice: dto.salePrice,
          status: dto.status,
          notes: dto.notes,
        },
      });

      if (dto.status && dto.status !== line.status) {
        await tx.lineHistory.create({
          data: {
            lineId: line.id,
            action: 'STATUS_CHANGE',
            oldStatus: line.status,
            newStatus: dto.status,
            createdBy: currentUserId,
            notes: `Status updated from ${line.status} to ${dto.status}`,
          },
        });
      }

      await this.auditService.record(
        {
          action: AuditAction.UPDATE,
          entityType: 'Line',
          entityId: id,
          oldData: line,
          newData: updated,
          userId: currentUserId,
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string, currentUserId?: string) {
    const line = await this.prisma.line.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!line) {
      throw new NotFoundException('الخط غير موجود');
    }
    if (line.customerId || line.status === LineStatus.SOLD || line.status === LineStatus.ACTIVE) {
      throw new BadRequestException('لا يمكن حذف خط مرتبط بعميل أو نشط. يرجى إلغاء تخصيصه أولاً.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.lineHistory.deleteMany({ where: { lineId: id } });
      await tx.inventoryMovement.deleteMany({ where: { lineId: id } });
      await tx.line.delete({ where: { id } });

      await this.auditService.record(
        {
          action: AuditAction.DELETE,
          entityType: 'Line',
          entityId: id,
          oldData: line,
          userId: currentUserId,
        },
        tx,
      );

      return { success: true, message: 'Line deleted successfully' };
    });
  }
}
