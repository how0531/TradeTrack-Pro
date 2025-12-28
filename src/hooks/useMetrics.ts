
// [Manage] Last Updated: 2024-05-22
import { useMemo } from 'react';
import { Trade, Portfolio, Frequency, Lang, TimeRange } from '../types';
import { calculateMetrics, calculateStreaks } from '../utils/calculations';

export const useMetrics = (
    trades: Trade[],
    portfolios: Portfolio[],
    activePortfolioIds: string[],
    frequency: Frequency,
    lang: Lang,
    customRange: { start: string | null, end: string | null },
    filterStrategy: string[],
    filterEmotion: string[],
    timeRange: TimeRange
) => {
    return useMemo(() => {
        // 1. Filter by Portfolio
        const relevantTrades = trades.filter(t => {
            const pid = t.portfolioId || 'main';
            return activePortfolioIds.includes(pid);
        });

        // 2. Filter by Strategy & Emotion
        let filtered = relevantTrades;
        if (filterStrategy.length > 0) {
            filtered = filtered.filter(t => t.strategy && filterStrategy.includes(t.strategy));
        }
        if (filterEmotion.length > 0) {
            filtered = filtered.filter(t => t.emotion && filterEmotion.includes(t.emotion));
        }

        // 3. Filter by Time
        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (timeRange === '1M') {
            startDate = new Date();
            startDate.setMonth(now.getMonth() - 1);
            startDate.setHours(0, 0, 0, 0);
        } else if (timeRange === '3M') {
            startDate = new Date();
            startDate.setMonth(now.getMonth() - 3);
            startDate.setHours(0, 0, 0, 0);
        } else if (timeRange === 'YTD') {
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
        } else if (timeRange === 'CUSTOM' && customRange.start) {
            startDate = new Date(customRange.start);
            if (customRange.end) {
                endDate = new Date(customRange.end);
                endDate.setHours(23, 59, 59, 999);
            }
        }

        const filteredTrades = filtered.filter(t => {
            if (!startDate) return true;
            const d = new Date(t.date);
            if (endDate) return d >= startDate && d <= endDate;
            return d >= startDate;
        });

        // Sort descending by date
        filteredTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // 4. Calculate Metrics
        const metrics = calculateMetrics(filteredTrades, portfolios, activePortfolioIds, frequency, lang, startDate, endDate);

        // 5. Calculate Streaks
        const streaks = calculateStreaks(filteredTrades);

        // 6. Risk Streaks
        const riskStreaks = streaks; 

        // 7. Daily PnL Map
        const dailyPnlMap: Record<string, number> = {};
        filteredTrades.forEach(t => {
            const date = t.date;
            dailyPnlMap[date] = (dailyPnlMap[date] || 0) + (Number(t.pnl) || 0);
        });

        return { filteredTrades, metrics, streaks, riskStreaks, dailyPnlMap };

    }, [trades, portfolios, activePortfolioIds, frequency, lang, customRange, filterStrategy, filterEmotion, timeRange]);
};
