import { describe, it, expect } from 'vitest';
import { calculateMetrics, calculateStreaks } from './calculations';
import { Trade, Portfolio } from '../types';

// Mock Data
const mockPortfolios: Portfolio[] = [
    { id: 'p1', name: 'Main', initialCapital: 100000, profitColor: '#C8B085', lossColor: '#D05A5A' }
];

const mockTrades: Trade[] = [
    { id: '1', date: '2024-01-01', pnl: 1000, type: 'profit', strategy: 'A', portfolioId: 'p1' },
    { id: '2', date: '2024-01-02', pnl: -500, type: 'loss', strategy: 'A', portfolioId: 'p1' },
];

describe('Calculations - Metrics', () => {
    it('should calculate Net Profit correctly', () => {
        const result = calculateMetrics(mockTrades, mockPortfolios, ['p1'], 'daily', 'en', null, null);
        // 1000 - 500 = 500
        expect(result.netProfit).toBe(500);
    });

    it('should calculate Win Rate correctly', () => {
        const result = calculateMetrics(mockTrades, mockPortfolios, ['p1'], 'daily', 'en', null, null);
        // 1 Win, 1 Loss = 50%
        expect(result.winRate).toBe(50);
    });

    it('should handle dates correctly (sort)', () => {
         const unsortedTrades = [
            { ...mockTrades[1], date: '2024-01-02' },
            { ...mockTrades[0], date: '2024-01-01' }
         ];
         // Logic inside sorts them
         const result = calculateMetrics(unsortedTrades, mockPortfolios, ['p1'], 'daily', 'en', null, null);
         // Curve should reflect order. 1st point after Start is Jan 1.
         // Index 0 is Start, Index 1 is Jan 1, Index 2 is Jan 2
         const curve = result.curve;
         expect(curve.length).toBeGreaterThan(2); 
         expect(curve[1].fullDate).toBe('2024-01-01');
    });

    it('should handle Infinite Risk/Reward (Win Only)', () => {
        const winOnlyTrades = [mockTrades[0]];
        const result = calculateMetrics(winOnlyTrades, mockPortfolios, ['p1'], 'daily', 'en', null, null);
        // No losses + at least one win: R:R is undefined mathematically.
        // calculations.ts contract returns Infinity in this case so the UI can
        // render a special glyph (∞) instead of a misleading 0.
        expect(result.riskReward).toBe(Infinity);

        // Profit Factor: gLoss === 0 ? (gProfit > 0 ? Infinity : 0) : gProfit / gLoss
        expect(result.pf).toBe(Infinity);
    });
});

describe('Calculations - Streaks', () => {
    it('should calculate streaks', () => {
       const streakTrades: Trade[] = [
           { ...mockTrades[0], id: 's1', pnl: 100 },
           { ...mockTrades[0], id: 's2', pnl: 100 },
           { ...mockTrades[0], id: 's3', pnl: -50 },
       ];
       const result = calculateStreaks(streakTrades);
       expect(result.bestWin).toBe(2);
       expect(result.currentLoss).toBe(1);
    });
});

// ─── v3.9.0 深度審計修復的迴歸測試 ───
// 每條測試對應一個 ultra-audit 確認的計算瑕疵，鎖住修復後的行為。

describe('v3.9.0 audit fixes', () => {
    const P: Portfolio[] = [
        { id: 'p1', name: 'Main', initialCapital: 100000, profitColor: '#C8B085', lossColor: '#D05A5A' }
    ];

    it('H2: winRate excludes scratch (pnl=0) trades from denominator', () => {
        const trades: Trade[] = [
            ...Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, date: '2026-03-02', pnl: 100, portfolioId: 'p1' })),
            ...Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, date: '2026-03-03', pnl: 0, portfolioId: 'p1' })),
        ];
        const m = calculateMetrics(trades, P, ['p1'], 'daily', 'zh', null, null);
        expect(m.winRate).toBe(100);          // 舊 bug: 33.33
        expect(m.totalTrades).toBe(15);       // 總筆數仍含平手
    });

    it('H2: stratStats winRate/avgLoss exclude scratch trades', () => {
        const trades: Trade[] = [
            { id: 'a', date: '2026-03-02', pnl: 300, strategy: 'X', portfolioId: 'p1' },
            { id: 'b', date: '2026-03-03', pnl: 0, strategy: 'X', portfolioId: 'p1' },
            { id: 'c', date: '2026-03-04', pnl: -100, strategy: 'X', portfolioId: 'p1' },
        ];
        const m = calculateMetrics(trades, P, ['p1'], 'daily', 'zh', null, null);
        expect(m.stratStats['X'].winRate).toBe(50);   // 1勝1負1平 → 50%（舊: 33.3）
        expect(m.stratStats['X'].avgLoss).toBe(100);  // 平手不稀釋平均虧損（舊: 50）
    });

    it('H1: endDateFilter clamps stagnation/sharpe/curve to the selected range', () => {
        const trades: Trade[] = Array.from({ length: 30 }, (_, i) => ({
            id: `q${i}`,
            date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
            pnl: i % 3 === 0 ? -500 : 800,
            portfolioId: 'p1',
        }));
        const unclamped = calculateMetrics(trades, P, ['p1'], 'daily', 'zh', null, null);
        const clamped = calculateMetrics(trades, P, ['p1'], 'daily', 'zh',
            new Date('2025/01/01'), new Date('2025/03/31'));

        // 停滯天數不再把區間結束後的所有交易日算進去
        expect(clamped.maxStagnationDays).toBeLessThan(70);
        expect(clamped.maxStagnationDays).toBeLessThan(unclamped.maxStagnationDays);
        // 曲線終點不超過 endDateFilter（不再有延伸到今天的平坦尾巴）
        const lastPoint = clamped.curve[clamped.curve.length - 1];
        expect(lastPoint.fullDate <= '2025-03-31').toBe(true);
        // Sharpe 不再被區間後的幽靈零報酬日稀釋
        expect(clamped.sharpe).toBeGreaterThan(unclamped.sharpe);
    });

    it('M1: maxDD is frequency-independent (daily granularity)', () => {
        const trades: Trade[] = [
            { id: 'd1', date: '2026-06-05', pnl: 10000, portfolioId: 'p1' },
            { id: 'd2', date: '2026-06-20', pnl: -8000, portfolioId: 'p1' },
            { id: 'd3', date: '2026-06-25', pnl: 9000, portfolioId: 'p1' },
        ];
        const daily = calculateMetrics(trades, P, ['p1'], 'daily', 'zh', null, null);
        const monthly = calculateMetrics(trades, P, ['p1'], 'monthly', 'zh', null, null);
        // 月檢視的期內回撤不再被淨額抵銷歸零
        expect(monthly.maxDD).toBeCloseTo(daily.maxDD, 5);
        expect(monthly.maxDD).toBeGreaterThan(5);  // 8000/110000 ≈ 7.27%
    });

    it('M6: scratch trade does not break a loss streak', () => {
        const trades: Trade[] = [
            { id: 's1', date: '2026-06-01', pnl: -100, portfolioId: 'p1', timestamp: '1' },
            { id: 's2', date: '2026-06-02', pnl: -100, portfolioId: 'p1', timestamp: '2' },
            { id: 's3', date: '2026-06-03', pnl: 0, portfolioId: 'p1', timestamp: '3' },
        ];
        const st = calculateStreaks(trades);
        expect(st.currentLoss).toBe(2);   // 舊 bug: 0（平手單解除連敗警報）
    });

    it('L1: an invalid-date trade no longer collapses the equity curve', () => {
        const trades: Trade[] = [
            { id: 'bad', date: 'garbage', pnl: 999, portfolioId: 'p1' },
            { id: 'ok', date: '2026-06-01', pnl: 500, portfolioId: 'p1' },
        ];
        const m = calculateMetrics(trades, P, ['p1'], 'daily', 'zh', null, null);
        expect(m.currentEq).toBe(100500);   // 舊 bug: 退回 100000（曲線塌縮）
        expect(m.curve.length).toBeGreaterThan(1);
    });
});
