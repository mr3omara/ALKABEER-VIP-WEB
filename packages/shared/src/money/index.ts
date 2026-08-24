/**
 * Strict Egyptian Pound (EGP) Integer Money Utility
 * 
 * HARD ARCHITECTURAL RULE:
 * All financial values are whole Egyptian Pounds only.
 * No piastres, no cents, no factor *100, no division /100.
 * Invariant: 100 EGP = 100 (integer)
 */

export type EGP = number;

export class Money {
  /**
   * Asserts that a value is a safe, whole integer representation of EGP.
   * Throws Error if decimal or NaN or non-integer.
   */
  static assertInteger(amount: number, fieldName = 'Amount'): number {
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      throw new Error(
        `[MoneyRuleViolation] ${fieldName} must be a whole integer in Egyptian Pounds (EGP). Received: ${amount}`
      );
    }
    if (!Number.isSafeInteger(amount)) {
      throw new Error(
        `[MoneyRuleViolation] ${fieldName} exceeds safe integer limits. Received: ${amount}`
      );
    }
    return amount;
  }

  /**
   * Asserts that amount is >= 0
   */
  static assertNonNegative(amount: number, fieldName = 'Amount'): number {
    this.assertInteger(amount, fieldName);
    if (amount < 0) {
      throw new Error(
        `[MoneyRuleViolation] ${fieldName} cannot be negative. Received: ${amount}`
      );
    }
    return amount;
  }

  /**
   * Asserts that amount is > 0
   */
  static assertPositive(amount: number, fieldName = 'Amount'): number {
    this.assertInteger(amount, fieldName);
    if (amount <= 0) {
      throw new Error(
        `[MoneyRuleViolation] ${fieldName} must be strictly positive (> 0 EGP). Received: ${amount}`
      );
    }
    return amount;
  }

  /**
   * Adds multiple integer EGP amounts safely.
   */
  static add(...amounts: number[]): number {
    return amounts.reduce((acc, curr) => {
      this.assertInteger(curr);
      return acc + curr;
    }, 0);
  }

  /**
   * Subtracts integer b from a (a - b).
   */
  static subtract(a: number, b: number): number {
    this.assertInteger(a, 'Minuend');
    this.assertInteger(b, 'Subtrahend');
    return a - b;
  }

  /**
   * Multiplies unit price (EGP) by whole quantity.
   */
  static multiply(unitPrice: number, quantity: number): number {
    this.assertInteger(unitPrice, 'UnitPrice');
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`[MoneyRuleViolation] Quantity must be a non-negative integer. Received: ${quantity}`);
    }
    return unitPrice * quantity;
  }

  /**
   * Formats integer or decimal EGP for display purposes with standard currency label.
   */
  static format(amount: number): string {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 EGP';
    return `${amount.toLocaleString('en-US')} EGP`;
  }
}
