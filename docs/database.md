# Database Domain & Schema Specification

## 1. PostgreSQL Schema Overview

The database is modeled via Prisma with strict foreign keys, cascade protections, and indexes for high performance.

### Core Entities

| Model | Table Name | Purpose | Primary Constraints & Indexes |
| :--- | :--- | :--- | :--- |
| **User** | `users` | System operators & staff | `@unique(username)`, `@unique(email)` |
| **Role** | `roles` | RBAC roles | `@unique(name)` |
| **Permission** | `permissions` | Granular action keys | `@unique(key)` |
| **Customer** | `customers` | Line owners & subscribers | `@unique(customer_code)`, `@index(phone, name, status)` |
| **Company** | `companies` | Telecom providers (Vodafone, Orange, etc.) | `@unique(name)`, `@unique(code)` |
| **Line** | `lines` | Phone lines inventory | `@unique(phone_number)`, `@index(company_id, customer_id, status)` |
| **LineHistory** | `line_history` | Ownership and status audit trace | `@index(line_id, created_at)` |
| **InventoryMovement** | `inventory_movements` | Immutable stock movement ledger | `@index(line_id, movement_type, created_at)` |
| **Sale** | `sales` | Sale transactions | `@unique(sale_number)`, `@index(customer_id, sale_date)` |
| **SaleItem** | `sale_items` | Multi-line sale items | `@index(sale_id, line_id)` |
| **Payment** | `payments` | Cash/bank collections | `@unique(payment_number)`, `@index(customer_id, payment_date)` |
| **PaymentAllocation** | `payment_allocations` | FIFO distribution across monthly dues | `@index(payment_id, charge_id)` |
| **MonthlyCharge** | `monthly_charges` | Discrete monthly obligations | `@@unique([line_id, billing_month])`, `@index(customer_id, due_date, status)` |
| **TreasuryAccount** | `treasury_accounts` | Cash, Bank, and Wallet accounts | `@unique(name)` |
| **TreasuryTransaction** | `treasury_transactions` | Cash flow movements (IN / OUT) | `@unique(transaction_number)`, `@index(account_id, transaction_date)` |
| **ExpenseCategory** | `expense_categories` | Expense categorization | `@unique(name)` |
| **Expense** | `expenses` | Outflow expenses | `@unique(expense_number)`, `@index(category_id, treasury_account_id)` |
| **DailyClosing** | `daily_closings` | Shift & day reconciliation | `@unique(business_date)` |
| **AuditLog** | `audit_logs` | Immutable audit trail | `@index([entity_type, entity_id], [user_id], [created_at])` |

## 2. Integrity & Referential Action Rules

- **Financial Integrity**: All relations referencing financial models (`Sale`, `Payment`, `MonthlyCharge`, `TreasuryTransaction`, `Expense`) use `onDelete: Restrict` to eliminate cascade deletions.
- **Monthly Charge Uniqueness**: `@@unique([lineId, billingMonth])` prevents duplicate monthly bill generation for the same phone line in a given month.
- **Daily Closing Singularity**: `@unique(business_date)` guarantees only one active record per business day.
- **Phone Number Uniqueness**: Database-level unique constraint on `lines.phone_number` and indexed search on `customers.phone`.
