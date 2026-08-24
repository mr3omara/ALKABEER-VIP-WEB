export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum LineStatus {
  IN_STOCK = 'IN_STOCK',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum InventoryMovementType {
  PURCHASE = 'PURCHASE',
  ADD = 'ADD',
  RESERVE = 'RESERVE',
  RELEASE = 'RELEASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  WALLET = 'WALLET',
  OTHER = 'OTHER',
}

export enum MonthlyChargeStatus {
  DUE = 'DUE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  WAIVED = 'WAIVED',
  CANCELLED = 'CANCELLED',
}

export enum TreasuryAccountType {
  CASH = 'CASH',
  BANK = 'BANK',
  WALLET = 'WALLET',
}

export enum TreasuryDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TreasuryTransactionType {
  SALE_PAYMENT = 'SALE_PAYMENT',
  EXPENSE = 'EXPENSE',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  OPENING_BALANCE = 'OPENING_BALANCE',
  TRANSFER = 'TRANSFER',
}

export enum DailyClosingStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
}

export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  REVERSAL = 'REVERSAL',
  STATUS_CHANGE = 'STATUS_CHANGE',
  DAILY_CLOSE = 'DAILY_CLOSE',
  DAILY_REOPEN = 'DAILY_REOPEN',
  EXPORT = 'EXPORT',
}
