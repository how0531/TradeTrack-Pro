/**
 * Regression tests for src/utils/format.ts.
 *
 * Anchors:
 *  - v3.5.0 changed formatDecimal(Infinity) from '∞' to '—' to make
 *    Risk/Reward and Profit Factor readable on accounts with no losses
 *    (or no wins). Lock that behaviour so a future refactor doesn't
 *    accidentally bring '∞' back.
 *  - Always-on invariants: null/undefined/NaN -> '0.00', normal
 *    numbers truncated to 2 decimals, sign preserved.
 */
import { describe, expect, it } from 'vitest';
import { formatDecimal } from './format';

describe('formatDecimal', () => {
    describe('non-finite inputs (v3.5.0 contract)', () => {
        it('returns "—" for positive Infinity (e.g. R:R with zero losses)', () => {
            expect(formatDecimal(Infinity)).toBe('—');
        });

        it('returns "—" for negative Infinity', () => {
            expect(formatDecimal(-Infinity)).toBe('—');
        });

        it('returns "0.00" for NaN', () => {
            expect(formatDecimal(NaN)).toBe('0.00');
        });

        it('returns "0.00" for null', () => {
            expect(formatDecimal(null)).toBe('0.00');
        });

        it('returns "0.00" for undefined', () => {
            expect(formatDecimal(undefined)).toBe('0.00');
        });
    });

    describe('finite inputs', () => {
        it('formats whole numbers to 2 decimals', () => {
            expect(formatDecimal(5)).toBe('5.00');
        });

        it('rounds to 2 decimals', () => {
            expect(formatDecimal(1.235)).toBe('1.24');  // banker's vs half-up — toFixed uses half-away-from-zero
        });

        it('preserves negative sign', () => {
            expect(formatDecimal(-3.14)).toBe('-3.14');
        });

        it('handles zero as 0.00', () => {
            expect(formatDecimal(0)).toBe('0.00');
        });

        it('handles very small positive numbers', () => {
            expect(formatDecimal(0.001)).toBe('0.00');
        });

        it('handles very large numbers', () => {
            expect(formatDecimal(1_000_000.5)).toBe('1000000.50');
        });
    });
});
