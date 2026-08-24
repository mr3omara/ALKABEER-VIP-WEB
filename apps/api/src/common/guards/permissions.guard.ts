import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { RequestUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    if (!user) {
      throw new ForbiddenException('User authentication context not established');
    }

    // ADMIN role possesses all permissions
    if (user.roles.includes('ADMIN')) {
      return true;
    }

    const userPermissions = new Set(user.permissions);
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.has(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Forbidden resource: Missing required permissions [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
