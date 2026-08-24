import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

export interface RecordAuditParams {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditParams, tx?: any) {
    const client = tx || this.prisma;
    try {
      return await client.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldData: params.oldData ? JSON.stringify(params.oldData) : null,
          newData: params.newData ? JSON.stringify(params.newData) : null,
          userId: params.userId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to write audit log: ${error?.message || error}`, error?.stack);
      // We do not throw error here to avoid blocking primary business operations unless inside transactional rollback
    }
  }

  async findMany(pagination: PaginationDto, entityType?: string, entityId?: string, action?: AuditAction) {
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;

    const [items, totalItems] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
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
