# Role-Based Access Control (RBAC) Specification

## 1. Roles Hierarchy

1. **ADMIN**: Full unrestricted access across all system entities, settings, and audits.
2. **MANAGER**: Operational authority over customers, lines, sales, collections, expenses, and closings.
3. **ACCOUNTANT**: Financial management, payments, charge reconciliations, expenses, and treasury.
4. **SALES**: Line sales, customer onboarding, upfront collection.
5. **VIEWER**: Read-only access to customer cards, lines catalog, and reports.

## 2. Server-Side Enforcement

Every protected endpoint uses:
```typescript
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.SALES_CREATE)
```

- If `user.roles.includes('ADMIN')` $\to$ **Allowed**.
- If `user.permissions.includes(requiredPermission)` $\to$ **Allowed**.
- Otherwise $\to$ **HTTP 403 Forbidden**.
