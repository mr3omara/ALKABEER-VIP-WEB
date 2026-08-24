# Business Rules & Workflows Specification

## 1. Line Lifecycle & Inventory Movements

```
[ IN_STOCK ] ──( Sale )──> [ SOLD ] ──( Activation )──> [ ACTIVE ]
      │                         │                              │
(Adjustment/Reserve)    (Sale Cancellation)                    │
      ▼                         ▼                              ▼
 [ RESERVED ]             [ RETURNED ]                 [ SUSPENDED ]
```

- A line can ONLY be sold if its current status is `IN_STOCK`.
- Selling or returning a line automatically creates an immutable record in `inventory_movements`.
- Concurrency protection: Atomic conditional query prevents two operators from selling the same line simultaneously.

## 2. Customer Management & Deletion Safety

- Customers with active lines, sale records, payments, or outstanding bills **cannot be physically or soft-deleted**.
- The operator is instructed to mark the customer as `INACTIVE` or `BLOCKED` instead.

## 3. Daily Closing & Cashier Reconciliation

- Each business date has exactly one closing record.
- Expected Balance Formula:
  $$\text{Expected Balance} = \text{Opening Balance} + \sum \text{Day Payments} - \sum \text{Day Expenses}$$
- Difference:
  $$\text{Difference} = \text{Actual Physical Balance} - \text{Expected Balance}$$
- Reopening a closed day requires `daily_closing.reopen` permission and writes a mandatory audit log entry.
