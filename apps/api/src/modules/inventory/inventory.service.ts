import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, InventoryMovementType, LineStatus, Money } from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface TelecomPackage {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  faceValue: number; // قبل الضريبة
  costPrice: number; // تكلفة بعد الضريبة
  sellingPrice: number; // سعر البيع / الاشتراك
  profitMargin: number; // سعر البيع - التكلفة
  details?: string;
  activeLinesCount: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Database-level package deduplication:
   * Finds all packages with identical (name + sellingPrice), keeps the primary record,
   * and permanently removes all duplicates from PostgreSQL.
   */
  async cleanupPackageDuplicates(): Promise<{ removedCount: number; remainingCount: number }> {
    const allPackages = await this.prisma.package.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Map<string, string>();
    const toDeleteIds: string[] = [];

    for (const pkg of allPackages) {
      const key = `${pkg.name.trim().toLowerCase()}__${pkg.sellingPrice}`;
      if (!seen.has(key)) {
        seen.set(key, pkg.id);
      } else {
        toDeleteIds.push(pkg.id);
      }
    }

    if (toDeleteIds.length > 0) {
      await this.prisma.package.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }

    const remainingCount = await this.prisma.package.count();
    return {
      removedCount: toDeleteIds.length,
      remainingCount,
    };
  }

  // ----------------------------------------------------
  // INVENTORY MOVEMENTS LEDGER
  // ----------------------------------------------------

  async getMovements(
    pagination: PaginationDto,
    lineId?: string,
    movementType?: InventoryMovementType,
  ) {
    const where: any = {};
    if (lineId) where.lineId = lineId;
    if (movementType) where.movementType = movementType;

    const [items, totalItems] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          line: {
            select: { id: true, phoneNumber: true, status: true, company: true },
          },
          creator: {
            select: { id: true, username: true, fullName: true },
          },
        },
      }),
      this.prisma.inventoryMovement.count({ where }),
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

  async adjustStock(
    lineId: string,
    movementType: InventoryMovementType,
    notes: string,
    currentUserId?: string,
  ) {
    const line = await this.prisma.line.findUnique({ where: { id: lineId } });
    if (!line) {
      throw new NotFoundException('Line not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          lineId,
          movementType,
          quantity: 1,
          referenceType: 'MANUAL_ADJUSTMENT',
          notes,
          createdBy: currentUserId,
        },
      });

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'InventoryMovement',
          entityId: movement.id,
          newData: { lineId, movementType, notes },
          userId: currentUserId,
        },
        tx,
      );

      return movement;
    });
  }

  // ----------------------------------------------------
  // TELECOM PACKAGES & SUBSCRIPTIONS HUB (Database Driven)
  // ----------------------------------------------------

  async getPackages(search?: string, companyId?: string) {
    const where: any = {};
    if (companyId && typeof companyId === 'string' && companyId.trim() !== '') {
      where.OR = [
        { companyId: companyId.trim() },
        { company: { code: companyId.trim().toUpperCase() } },
      ];
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    // 1. Fetch DB packages from Prisma
    const dbPackages = await this.prisma.package.findMany({
      where,
      include: { company: true },
      orderBy: { sellingPrice: 'asc' },
    });

    // 2. Fetch live line counts from DB
    const lines = await this.prisma.line.findMany({
      select: { monthlyPackage: true },
    });

    const countsMap: Record<number, number> = {};
    for (const l of lines) {
      if (l.monthlyPackage) {
        countsMap[l.monthlyPackage] = (countsMap[l.monthlyPackage] || 0) + 1;
      }
    }

    // 3. Strict Deduplication by (name + sellingPrice)
    const combined: TelecomPackage[] = [];
    const seenKeys = new Set<string>();

    for (const dbPkg of dbPackages) {
      const key = `${dbPkg.name.trim().toLowerCase()}__${dbPkg.sellingPrice}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const activeCount = countsMap[dbPkg.sellingPrice] || 0;
      const cost = dbPkg.costPrice || Math.round(dbPkg.sellingPrice * 0.85);
      const face = dbPkg.faceValue || Math.round(dbPkg.sellingPrice * 0.70);
      combined.push({
        id: dbPkg.id,
        name: dbPkg.name,
        companyId: dbPkg.companyId || dbPkg.company?.id || '',
        companyName: dbPkg.company?.name || 'شركة اتصالات',
        companyCode: dbPkg.company?.code || 'B2B',
        faceValue: face,
        costPrice: cost,
        sellingPrice: dbPkg.sellingPrice,
        profitMargin: Number((dbPkg.sellingPrice - cost).toFixed(2)),
        details: dbPkg.details || undefined,
        activeLinesCount: activeCount,
        status: (dbPkg.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
        createdAt: dbPkg.createdAt.toISOString(),
      });
    }

    return {
      items: combined,
      meta: {
        total: combined.length,
      },
    };
  }

  async createPackage(
    dto: {
      name: string;
      companyId: string;
      faceValue: number;
      costPrice: number;
      sellingPrice: number;
      details?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    },
    userId?: string,
  ) {
    const costPrice = dto.costPrice || Math.round(dto.sellingPrice * 0.85);
    const faceValue = dto.faceValue || Math.round(dto.sellingPrice * 0.70);

    const pkg = await this.prisma.package.upsert({
      where: {
        name_sellingPrice: {
          name: dto.name.trim(),
          sellingPrice: dto.sellingPrice,
        },
      },
      update: {
        companyId: dto.companyId || undefined,
        costPrice,
        faceValue,
        details: dto.details?.trim() || undefined,
        status: dto.status || 'ACTIVE',
      },
      create: {
        name: dto.name.trim(),
        companyId: dto.companyId || undefined,
        sellingPrice: dto.sellingPrice,
        costPrice,
        faceValue,
        details: dto.details?.trim() || undefined,
        status: dto.status || 'ACTIVE',
      },
      include: { company: true },
    });

    await this.auditService.record({
      action: AuditAction.CREATE,
      entityType: 'TelecomPackage',
      entityId: pkg.id,
      newData: pkg,
      userId,
    });

    return {
      id: pkg.id,
      name: pkg.name,
      companyId: pkg.companyId || '',
      companyName: pkg.company?.name || 'شركة اتصالات',
      companyCode: pkg.company?.code || 'B2B',
      faceValue: pkg.faceValue,
      costPrice: pkg.costPrice,
      sellingPrice: pkg.sellingPrice,
      profitMargin: Number((pkg.sellingPrice - pkg.costPrice).toFixed(2)),
      details: pkg.details || undefined,
      activeLinesCount: 0,
      status: pkg.status as 'ACTIVE' | 'INACTIVE',
      createdAt: pkg.createdAt.toISOString(),
    };
  }

  async updatePackage(
    id: string,
    dto: {
      name?: string;
      faceValue?: number;
      costPrice?: number;
      sellingPrice?: number;
      details?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    },
    userId?: string,
  ) {
    const pkg = await this.prisma.package.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        faceValue: dto.faceValue !== undefined ? dto.faceValue : undefined,
        costPrice: dto.costPrice !== undefined ? dto.costPrice : undefined,
        sellingPrice: dto.sellingPrice !== undefined ? dto.sellingPrice : undefined,
        details: dto.details !== undefined ? dto.details : undefined,
        status: dto.status !== undefined ? dto.status : undefined,
      },
      include: { company: true },
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      entityType: 'TelecomPackage',
      entityId: id,
      newData: pkg,
      userId,
    });

    return {
      id: pkg.id,
      name: pkg.name,
      companyId: pkg.companyId || '',
      companyName: pkg.company?.name || 'شركة اتصالات',
      companyCode: pkg.company?.code || 'B2B',
      faceValue: pkg.faceValue,
      costPrice: pkg.costPrice,
      sellingPrice: pkg.sellingPrice,
      profitMargin: Number((pkg.sellingPrice - pkg.costPrice).toFixed(2)),
      details: pkg.details || undefined,
      activeLinesCount: 0,
      status: pkg.status as 'ACTIVE' | 'INACTIVE',
      createdAt: pkg.createdAt.toISOString(),
    };
  }

  async deletePackage(id: string, userId?: string) {
    await this.prisma.package.delete({ where: { id } });

    await this.auditService.record({
      action: AuditAction.DELETE,
      entityType: 'TelecomPackage',
      entityId: id,
      userId,
    });

    return { success: true };
  }
}
