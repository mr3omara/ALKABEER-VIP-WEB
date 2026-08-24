# Financial Engine & Rules Specification

## 1. Egyptian Pound (EGP) Integer Representation

### The Strict Invariant
```
100 EGP  ==  100 (Integer)
250 EGP  ==  250 (Integer)
1250 EGP == 1250 (Integer)
```

- **NO Piastres / Cents**: The business domain operates solely in whole Egyptian Pounds.
- **NO Decimal Fractions**: Floating-point numbers (`0.50`, `99.99`) are strictly forbidden and rejected at runtime by the `Money` utility (`Money.assertInteger`).
- **NO Scaling Multipliers**: Never store `10000` for `100 EGP`.
- **Database Type**: PostgreSQL `INTEGER` (and `BigInt` with string serialization for file sizes/telemetry).

## 2. FIFO Payment Allocation Strategy

When a customer pays an amount (e.g., `250 EGP`), the system allocates funds across outstanding `MonthlyCharge` obligations using the First-In, First-Out (FIFO) rule:

1. Retrieve charges with status `DUE` or `PARTIALLY_PAID`.
2. Order charges by:
   - `due_date ASC`
   - `created_at ASC`
   - `id ASC`
3. Allocate amount:
   $$\text{allocation} = \min(\text{unallocated\_payment}, \text{charge.amount} - \text{charge.paid\_amount})$$
4. Update charge:
   - If $\text{paid\_amount} = \text{amount} \implies \text{Status} = \text{PAID}$
   - If $\text{paid\_amount} < \text{amount} \implies \text{Status} = \text{PARTIALLY\_PAID}$

## 3. Financial Immutability & Reversals

To maintain an untampered ledger audit trail:
- Finalized sales, payments, expenses, and treasury transactions are **never deleted**.
- Corrections are recorded as **compensating transactions**:
  - Reversing a payment marks `is_reversed = true`, creates a `TreasuryTransaction` of direction `OUT` with type `REFUND`, and restores the unpaid balance on the linked monthly charges.
  - Cancelling a sale marks `status = CANCELLED`, returns lines to `IN_STOCK`, creates `InventoryMovement` with type `RETURN`, and refunds any recorded upfront payments.
