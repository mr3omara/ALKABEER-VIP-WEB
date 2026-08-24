import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '@alkabeer/shared';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getAll() {
    return this.prisma.setting.findMany();
  }

  async getByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async set(key: string, value: string, description?: string, currentUserId?: string) {
    const existing = await this.prisma.setting.findUnique({ where: { key } });

    const result = await this.prisma.setting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description },
    });

    await this.auditService.record({
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entityType: 'Setting',
      entityId: key,
      oldData: existing,
      newData: result,
      userId: currentUserId,
    });

    return result;
  }
}
