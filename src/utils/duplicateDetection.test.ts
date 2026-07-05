/**
 * Regression tests for the duplicate-detection logic that gated the broker
 * P&L import flow.
 *
 * Background: when Shioaji's response omits an order number, SyncDateModal
 * used to fall back to writing a synthetic `unknown-${i}` onto the saved
 * trade. The next sync would start counting from `unknown-0` again, so
 * Method A's `trade.orderNo === other.orderNo` falsely matched every new
 * trade against a previously-imported one and the UI flagged real, fresh
 * trades as "already exists". These tests pin the post-fix behaviour.
 */

import { describe, it, expect } from 'vitest';
import { detectDuplicates } from './duplicateDetection';
import type { Trade } from '../types';

const baseTrade = (overrides: Partial<Trade>): Trade => ({
    id: overrides.id ?? Math.random().toString(36).slice(2),
    date: '2026-05-12',
    pnl: 100,
    code: '2330 TSMC',
    quantity: 1,
    price: 900,
    ...overrides,
});

describe('detectDuplicates — synthetic orderNo handling', () => {
    it('does NOT collapse two real trades that both carry synthetic `unknown-*` orderNos', () => {
        // Two trades on different days that share the synthetic unknown-0
        // because each came from its own broker sync batch.
        const trades: Trade[] = [
            baseTrade({ id: 'a', date: '2026-05-01', pnl: 100, orderNo: 'unknown-0' }),
            baseTrade({ id: 'b', date: '2026-05-12', pnl: 200, orderNo: 'unknown-0', code: '0050 ETF' }),
        ];

        const groups = detectDuplicates(trades);
        expect(groups).toHaveLength(0);
    });

    it('still collapses two trades that share a real broker orderNo', () => {
        const trades: Trade[] = [
            baseTrade({ id: 'a', orderNo: 'F8X9-2026051200001' }),
            baseTrade({ id: 'b', orderNo: 'F8X9-2026051200001' }),
        ];

        const groups = detectDuplicates(trades);
        expect(groups).toHaveLength(1);
        expect(groups[0].duplicates.map(t => t.id)).toEqual(['b']);
    });

    it('still collapses content-identical trades that have no orderNo at all', () => {
        // No orderNo on either side → falls back to date + code + pnl + qty + price.
        const trades: Trade[] = [
            baseTrade({ id: 'a' }),
            baseTrade({ id: 'b' }),
        ];

        const groups = detectDuplicates(trades);
        expect(groups).toHaveLength(1);
        expect(groups[0].duplicates.map(t => t.id)).toEqual(['b']);
    });

    it('does NOT collapse same-day same-stock trades when quantity differs', () => {
        const trades: Trade[] = [
            baseTrade({ id: 'a', quantity: 1, price: 900, pnl: 100 }),
            baseTrade({ id: 'b', quantity: 5, price: 900, pnl: 100 }),
        ];

        const groups = detectDuplicates(trades);
        expect(groups).toHaveLength(0);
    });
});

// ─── v3.9.1 H7 迴歸測試 ───
describe('v3.9.1: Method A requires date+code, not orderNo alone', () => {
    it('does NOT flag two unrelated trades that share a row-index orderNo', () => {
        // Shioaji ProfitLoss.id 是列序號：帳號 A 與帳號 B 的第 0 筆都拿到 '0'
        const trades: Trade[] = [
            { id: 'a', date: '2026-06-10', code: '2330 台積電', pnl: 5000, orderNo: '0', quantity: 1, price: 600 },
            { id: 'b', date: '2026-06-11', code: '6147 頎邦', pnl: -2000, orderNo: '0', quantity: 2, price: 80 },
        ];
        const groups = detectDuplicates(trades);
        expect(groups.length).toBe(0);   // 舊 bug: 判成重複 → removeDuplicates 刪掉一筆真實交易
    });

    it('still flags true duplicates (same orderNo + same date + same code)', () => {
        const trades: Trade[] = [
            { id: 'a', date: '2026-06-10', code: '2330 台積電', pnl: 5000, orderNo: 'X123', quantity: 1, price: 600 },
            { id: 'b', date: '2026-06-10', code: '2330 台積電', pnl: 5000, orderNo: 'X123', quantity: 1, price: 600 },
        ];
        const groups = detectDuplicates(trades);
        expect(groups.length).toBe(1);
    });
});
