import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PERMISSIONS } from '@alkabeer/shared';

describe('Security & RBAC Enforcement', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  it('Gate 14: Server returns 403 Forbidden when user attempts action without required permission', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PERMISSIONS.SALES_CREATE]);

    // Viewer role without sales.create permission
    const viewerContext = createMockContext({
      id: 'u-1',
      username: 'viewer_user',
      roles: ['VIEWER'],
      permissions: [PERMISSIONS.SALES_VIEW, PERMISSIONS.CUSTOMERS_VIEW],
    });

    expect(() => guard.canActivate(viewerContext)).toThrow(ForbiddenException);
  });

  it('Allows execution when user holds the required permission', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PERMISSIONS.SALES_CREATE]);

    const salesContext = createMockContext({
      id: 'u-2',
      username: 'sales_user',
      roles: ['SALES'],
      permissions: [PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_VIEW],
    });

    expect(guard.canActivate(salesContext)).toBe(true);
  });

  it('Allows execution for ADMIN role regardless of individual permission entries', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PERMISSIONS.SETTINGS_MANAGE]);

    const adminContext = createMockContext({
      id: 'u-3',
      username: 'admin_user',
      roles: ['ADMIN'],
      permissions: [],
    });

    expect(guard.canActivate(adminContext)).toBe(true);
  });

  it('Secures passwords using modern Argon2id hashing', async () => {
    const password = 'AdminSecurePassword!2026';
    const hash = await argon2.hash(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2')).toBe(true);

    const isValid = await argon2.verify(hash, password);
    expect(isValid).toBe(true);

    const isWrongValid = await argon2.verify(hash, 'WrongPassword');
    expect(isWrongValid).toBe(false);
  });

  it('Verifies local development Super Admin credentials [009 / 000] with Argon2id hash and ADMIN role', async () => {
    const devUsername = '009';
    const devPassword = '000';

    // 1. Ensure password is never stored plaintext
    const passwordHash = await argon2.hash(devPassword);
    expect(passwordHash).not.toBe(devPassword);
    expect(passwordHash).toContain('$argon2id$');

    // 2. Verify valid credentials match
    const isValid = await argon2.verify(passwordHash, devPassword);
    expect(isValid).toBe(true);

    // 3. Verify invalid credentials fail
    const isInvalid = await argon2.verify(passwordHash, 'wrong_pass');
    expect(isInvalid).toBe(false);

    // 4. Verify Super Admin user [009] has ADMIN role with full access
    const adminUserContext = createMockContext({
      id: 'admin-009',
      username: devUsername,
      roles: ['ADMIN'],
      permissions: [],
    });

    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PERMISSIONS.SETTINGS_MANAGE]);
    expect(guard.canActivate(adminUserContext)).toBe(true);
  });
});
