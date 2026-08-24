import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as argon2 from 'argon2';
import { AuditAction } from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, currentUserId?: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existing) {
      throw new ConflictException('Username or Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          fullName: dto.fullName,
          passwordHash,
          status: 'ACTIVE',
        },
      });

      if (dto.roles && dto.roles.length > 0) {
        for (const roleName of dto.roles) {
          const role = await tx.role.findUnique({ where: { name: roleName } });
          if (role) {
            await tx.userRole.create({
              data: {
                userId: user.id,
                roleId: role.id,
                assignedBy: currentUserId,
              },
            });
          }
        }
      }

      await this.auditService.record(
        {
          action: AuditAction.CREATE,
          entityType: 'User',
          entityId: user.id,
          newData: { username: user.username, email: user.email, roles: dto.roles },
          userId: currentUserId,
        },
        tx,
      );

      return this.findOne(user.id, tx);
    });
  }

  async findMany(pagination: PaginationDto) {
    const where: any = {};
    if (pagination.search) {
      where.OR = [
        { username: { contains: pagination.search, mode: 'insensitive' } },
        { fullName: { contains: pagination.search, mode: 'insensitive' } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, totalItems] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
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
    const user = await client.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: { fullName?: string; email?: string; roles?: string[] }, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName !== undefined ? dto.fullName : user.fullName,
          email: dto.email !== undefined ? dto.email : user.email,
        },
      });

      if (dto.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        for (const roleName of dto.roles) {
          const role = await tx.role.findUnique({ where: { name: roleName } });
          if (role) {
            await tx.userRole.create({
              data: {
                userId: id,
                roleId: role.id,
                assignedBy: currentUserId,
              },
            });
          }
        }
      }

      await this.auditService.record(
        {
          action: AuditAction.UPDATE,
          entityType: 'User',
          entityId: id,
          newData: { fullName: dto.fullName, email: dto.email, roles: dto.roles },
          userId: currentUserId,
        },
        tx,
      );

      return this.findOne(id, tx);
    });
  }

  async changePassword(id: string, newPassword: string, currentUserId?: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await this.auditService.record({
      action: AuditAction.UPDATE,
      entityType: 'UserPassword',
      entityId: id,
      userId: currentUserId,
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED', currentUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    await this.auditService.record({
      action: AuditAction.STATUS_CHANGE,
      entityType: 'User',
      entityId: id,
      newData: { status },
      userId: currentUserId,
    });

    return this.findOne(id);
  }
}
