import { describe, it, expect } from 'vitest';
import { Money } from '@alkabeer/shared';

describe('Financial Engine: Egyptian Pound (EGP) Integer Rules', () => {
  it('CRITICAL: 100 EGP must strictly equal integer 100 (never 10000, never 100.00)', () => {
    const amount = 100;
    expect(Money.assertInteger(amount)).toBe(100);
    expect(Money.assertNonNegative(amount)).toBe(100);
    expect(Money.assertPositive(amount)).toBe(100);
    expect(Money.format(amount)).toBe('100 EGP');
  });

  it('rejects floating-point numbers and fractions everywhere', () => {
    expect(() => Money.assertInteger(100.5)).toThrow('[MoneyRuleViolation]');
    expect(() => Money.assertInteger(99.99)).toThrow('[MoneyRuleViolation]');
    expect(() => Money.assertNonNegative(50.25)).toThrow('[MoneyRuleViolation]');
    expect(() => Money.assertPositive(0.5)).toThrow('[MoneyRuleViolation]');
  });

  it('rejects negative numbers when non-negative or positive is required', () => {
    expect(() => Money.assertNonNegative(-50)).toThrow('[MoneyRuleViolation]');
    expect(() => Money.assertPositive(-100)).toThrow('[MoneyRuleViolation]');
    expect(() => Money.assertPositive(0)).toThrow('[MoneyRuleViolation]');
  });

  it('performs pure integer arithmetic without floating-point errors', () => {
    const sum = Money.add(100, 250, 1250);
    expect(sum).toBe(1600);

    const diff = Money.subtract(500, 150);
    expect(diff).toBe(350);

    const mult = Money.multiply(150, 3);
    expect(mult).toBe(450);
  });
});
