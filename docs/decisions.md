# Architectural Decision Records (ADRs)

## ADR-001: Egyptian Pound (EGP) Integer Representation
- **Decision**: All financial figures are represented strictly as whole integers in Egyptian Pounds (EGP).
- **Rationale**: The business domain never utilizes fractional piastres. Eliminating decimal places and scale multiplications prevents precision loss, floating-point bugs, and accidental currency conversions.
- **Invariant**: 100 EGP = 100 integer.

## ADR-002: HttpOnly Cookie Authentication vs LocalStorage
- **Decision**: Secure HttpOnly cookies are used for web browser authentication sessions instead of storing JWTs in localStorage.
- **Rationale**: Mitigates credential theft via Cross-Site Scripting (XSS). Server-side validation occurs on every request.

## ADR-003: Append-Only Financial Immutability & Reversals
- **Decision**: Destructive `DELETE` or silent `UPDATE` operations are disallowed on completed sales, payments, expenses, and treasury movements.
- **Rationale**: Auditing integrity and legal accounting require an untampered paper trail. Adjustments occur through explicit compensating reversals (`REVERSAL`).

## ADR-004: FIFO Payment Allocation Across Discrete Monthly Charges
- **Decision**: Replaced mutable arrears numbers with discrete `MonthlyCharge` entities allocated via FIFO (`dueDate ASC, createdAt ASC`).
- **Rationale**: Provides clear traceability: how much a customer owes, exactly which months are unpaid, and how payments were distributed.

## ADR-005: Concurrency Protection on Line Stock
- **Decision**: Implemented atomic conditional updates (`WHERE id = ? AND status = 'IN_STOCK'`) inside database transactions.
- **Rationale**: Prevents double-selling race conditions when multiple operators attempt to sell the same line simultaneously.
