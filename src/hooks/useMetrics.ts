
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
    // 1. Filter Trades (Expensive)
    const filteredTrades = useMemo(() => {
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
            startDate = new Date(customRange.start.replace(/-/g, '/'));
            if (customRange.end) {
                endDate = new Date(customRange.end.replace(/-/g, '/'));
                endDate.setHours(23, 59, 59, 999);
            }
        }

        const result = filtered.filter(t => {
            if (!startDate) return true;
            // Safari bug: 'YYYY-MM-DD' parses as UTC which can shift days. 'YYYY/MM/DD' forces local time.
            const safeDateStr = (t.date || '').replace(/-/g, '/');
            const d = new Date(safeDateStr);
            if (endDate) return d >= startDate && d <= endDate;
            return d >= startDate;
        });

        // Sort descending by date
        return result.sort((a, b) => new Date((b.date || '').replace(/-/g, '/')).getTime() - new Date((a.date || '').replace(/-/g, '/')).getTime());

    }, [trades, activePortfolioIds, filterStrategy, filterEmotion, timeRange, customRange]);

    // 2. Calculate Metrics (Dependent on filteredTrades + Frequency) - RECALCS ONLY ON FREQ CHANGE
    const metrics = useMemo(() => {
        // Re-derive start/end date for metrics calc normalization if needed or pass null
        // The original logic calculated dates inside. We should pass the same logic or let calcMetrics handle it.
        // But calculateMetrics takes startDate/endDate.
        // We need to replicate the date logic or extract it?
        // Actually calculateMetrics uses startDate/endDate to Normalize the curve start?
        // Let's re-calculate dates here cheaply.

        const now = new Date();
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (timeRange === '1M') { start: startDate = new Date(); startDate.setMonth(now.getMonth() - 1); startDate.setHours(0, 0, 0, 0); }
        else if (timeRange === '3M') { startDate = new Date(); startDate.setMonth(now.getMonth() - 3); startDate.setHours(0, 0, 0, 0); }
        else if (timeRange === 'YTD') { startDate = new Date(now.getFullYear(), 0, 1); startDate.setHours(0, 0, 0, 0); }
        else if (timeRange === 'CUSTOM' && customRange.start) {
            startDate = new Date(customRange.start.replace(/-/g, '/'));
            if (customRange.end) { endDate = new Date(customRange.end.replace(/-/g, '/')); endDate.setHours(23, 59, 59, 999); }
        }

        return calculateMetrics(filteredTrades, portfolios, activePortfolioIds, frequency, lang, startDate, endDate);
    }, [filteredTrades, portfolios, activePortfolioIds, frequency, lang, timeRange, customRange]);

    // 3. Streaks (Dependent only on filteredTrades)
    const streaks = useMemo(() => calculateStreaks(filteredTrades), [filteredTrades]);

    // 4. Risk Streaks (Alias)
    const riskStreaks = streaks;

    // 5. Daily PnL Map (Dependent only on filteredTrades)
    const dailyPnlMap = useMemo(() => {
        const map: Record<string, number> = {};
        filteredTrades.forEach(t => {
            const date = (t.date || '').replace(/[\.\/]/g, '-');
            map[date] = (map[date] || 0) + (Number(t.pnl) || 0);
        });
        return map;
    }, [filteredTrades]);

    return { filteredTrades, metrics, streaks, riskStreaks, dailyPnlMap };
};

