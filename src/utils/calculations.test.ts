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
        // R:R logic: if losses == 0, if gProfit > 0 return 999 or handled? 
        // In code: (losses > 0 && gLoss > 0) ? ... : 0
        // Wait, if no loss, R:R is technically undef or inf. Code returns 0 currently for safety?
        // Let's check source: (losses > 0 && gLoss > 0) ? ... : 0.
        // So it returns 0. That's why ShareCard handled it manually?
        expect(result.riskReward).toBe(0);
        
        // Profit Factor should be specialized?
        // pf: gLoss === 0 ? (gProfit > 0 ? 999 : 0) : gProfit / gLoss
        expect(result.pf).toBe(999);
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
