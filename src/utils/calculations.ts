// [Manage] Last Updated: 2024-05-22
import { Trade, Portfolio, Frequency, Metrics, StrategyStat, Lang, Streaks } from '../types';
import { formatDate } from './format';

// Helper to get start of period
const getPeriodKey = (dateStr: string, freq: Frequency): string => {
    if (freq === 'daily') return dateStr;
    
    const parts = dateStr.split('-').map(Number);
    // Construct local date from YYYY-MM-DD parts
    const d = new Date(parts[0], parts[1] - 1, parts[2]);

    if (freq === 'weekly') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        d.setDate(diff);
    } else if (freq === 'monthly') {
        d.setDate(1);
    } else if (freq === 'quarterly') {
        d.setDate(1);
        d.setMonth(Math.floor(d.getMonth() / 3) * 3);
    } else if (freq === 'yearly') {
        d.setMonth(0, 1);
    }

    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
};

// Helper to format Date object to YYYY-MM-DD local string
const toLocalISO = (d: Date) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
};

export const calculateMetrics = (
    trades: Trade[],
    portfolios: Portfolio[],
    activePortfolioIds: string[],
    frequency: Frequency,
    lang: Lang,
    startDateFilter: Date | null,
    endDateFilter: Date | null
): Metrics => {
    // 1. Calculate Initial Capital for Active Portfolios
    const activeInitialCapital = portfolios
        .filter(p => activePortfolioIds.includes(p.id))
        .reduce((sum, p) => sum + (p.initialCapital || 0), 0);

    const safeCapital = activeInitialCapital > 0 ? activeInitialCapital : 100000;

    // 2. Filter Trades & Sort by Date (Robust Timestamp Sort)
    const sortedTrades = [...trades].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        const valA = isNaN(timeA) ? 0 : timeA;
        const valB = isNaN(timeB) ? 0 : timeB;
        return valA - valB;
    });

    // 3. Strategy Statistics Calculation
    const stratStats: Record<string, StrategyStat> = {};
    const uniqueStrats = [...new Set(trades.filter(t => t.strategy).map(t => t.strategy!))];
    
    uniqueStrats.forEach(strat => {
        const sTrades = sortedTrades.filter(t => t.strategy === strat);
        let sPnL = 0;
        let sPeak = 0;
        let sWin = 0;
        let sMinDDAmt = 0;
        let sGrossProfit = 0;
        let sGrossLoss = 0;
        let sCurrentEquity = 0; 

        sTrades.forEach(t => {
            const val = Number(t.pnl) || 0; 
            sPnL += val; 
            sCurrentEquity += val;
            
            if (val > 0) { 
                sWin++;
                sGrossProfit += val;
            } else if (val < 0) {
                sGrossLoss += Math.abs(val);
            }

            if (sCurrentEquity > sPeak) sPeak = sCurrentEquity;
            const currentDDAmt = sCurrentEquity - sPeak; 
            if (currentDDAmt < sMinDDAmt) sMinDDAmt = currentDDAmt;
        });
        
        stratStats[strat] = { 
            pnl: sPnL, 
            trades: sTrades.length, 
            winRate: sTrades.length > 0 ? (sWin / sTrades.length) * 100 : 0, 
            mddPct: safeCapital > 0 ? (Math.abs(sMinDDAmt) / safeCapital) * 100 : 0, 
            curDDPct: safeCapital > 0 ? (Math.abs(sCurrentEquity - sPeak) / safeCapital) * 100 : 0, 
            isNewHigh: (sPnL >= sPeak - 0.01) && sTrades.length > 0,
            riskReward: ((sTrades.length - sWin) > 0 && sGrossLoss > 0) ? (sGrossProfit/sWin) / (sGrossLoss/(sTrades.length-sWin)) : (sGrossProfit > 0 ? 10 : 0),
            avgWin: sWin > 0 ? sGrossProfit / sWin : 0, 
            avgLoss: (sTrades.length - sWin) > 0 ? sGrossLoss / (sTrades.length - sWin) : 0
        };
    });

    // 4. Basic Stats Aggregation
    let wins = 0, losses = 0, gProfit = 0, gLoss = 0;
    sortedTrades.forEach(t => {
        const p = Number(t.pnl) || 0;
        if (p > 0) { wins++; gProfit += p; } else if (p < 0) { losses++; gLoss += Math.abs(p); }
    });

    // --- NEW: Calculate Max Stagnation Days (Weekdays Only) ---
    // This is calculated based on daily intervals regardless of the requested chart frequency
    let maxStagnationDays = 0;
    let currentStagnationStreak = 0;
    let dailyEquity = safeCapital;
    let dailyPeak = safeCapital;
    
    if (sortedTrades.length > 0) {
        // Map trades to dates for fast lookup
        const dailyPnlMap = new Map<string, number>();
        sortedTrades.forEach(t => {
            const dStr = toLocalISO(new Date(t.date));
            dailyPnlMap.set(dStr, (dailyPnlMap.get(dStr) || 0) + Number(t.pnl));
        });

        const dCursor = new Date(sortedTrades[0].date);
        const dEnd = new Date(); // Today
        // Set to start of day to avoid time issues
        dCursor.setHours(0,0,0,0);
        dEnd.setHours(0,0,0,0);

        // Limit iteration to avoid infinite loops in edge cases (max 30 years)
        let safeCounter = 0;
        while(dCursor <= dEnd && safeCounter < 11000) {
            const dStr = toLocalISO(dCursor);
            const dayPnl = dailyPnlMap.get(dStr) || 0;
            dailyEquity += dayPnl;

            // Check Peak
            if (dailyEquity > dailyPeak) {
                // New High Achieved
                dailyPeak = dailyEquity;
                // Reset streak
                currentStagnationStreak = 0;
            } else {
                // Currently Underwater or at Peak (but trade might have happened)
                // Logic: Only count weekdays (Mon=1 ... Fri=5)
                const dayOfWeek = dCursor.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    currentStagnationStreak++;
                }
            }

            // Update Max
            if (currentStagnationStreak > maxStagnationDays) {
                maxStagnationDays = currentStagnationStreak;
            }

            dCursor.setDate(dCursor.getDate() + 1);
            safeCounter++;
        }
    }


    // 5. Equity Curve Construction
    // A. Aggregate trades into buckets first
    const periodGroups: Record<string, { totalPnl: number, portfolios: Record<string, number> }> = {};
    
    sortedTrades.forEach(t => {
        const d = getPeriodKey(t.date, frequency);
        if (!periodGroups[d]) periodGroups[d] = { totalPnl: 0, portfolios: {} };
        const val = Number(t.pnl) || 0;
        periodGroups[d].totalPnl += val;
        const pid = t.portfolioId || 'main';
        periodGroups[d].portfolios[pid] = (periodGroups[d].portfolios[pid] || 0) + val;
    });

    const curve: any[] = [];
    const drawdown: any[] = [];
    
    let equity = safeCapital;
    let peak = safeCapital;
    let maxDD = 0;

    // B. Determine Timeline Range
    // Start: Period of first trade OR Today if no trades
    const firstTradeDate = sortedTrades.length > 0 ? new Date(sortedTrades[0].date) : new Date();
    // Align to period start
    let cursor = new Date(getPeriodKey(toLocalISO(firstTradeDate), frequency));
    
    // End: Period of Today (Ensure chart goes up to now)
    const today = new Date();
    const endDateStr = getPeriodKey(toLocalISO(today), frequency);
    const endDate = new Date(endDateStr);

    // C. Add Anchor Point (One period before start)
    const anchor = new Date(cursor);
    if (frequency === 'daily') anchor.setDate(anchor.getDate() - 1);
    else if (frequency === 'weekly') anchor.setDate(anchor.getDate() - 7);
    else if (frequency === 'monthly') anchor.setMonth(anchor.getMonth() - 1);
    else if (frequency === 'quarterly') anchor.setMonth(anchor.getMonth() - 3);
    else if (frequency === 'yearly') anchor.setFullYear(anchor.getFullYear() - 1);

    curve.push({
        date: 'Start',
        fullDate: 'Start',
        timestamp: anchor.getTime(),
        equity: equity,
        peak: peak,
        pnl: 0,
        cumulativePnl: 0,
        isNewPeak: true,
        ddPct: 0,
        ddAmt: 0
    });
    drawdown.push({ date: 'Start', timestamp: anchor.getTime(), ddPct: 0 });

    // D. Iterate through every period from Start to End (Filling Gaps)
    // Safety break: 100 years approx to prevent infinite loop bugs
    let iterations = 0;
    while (cursor <= endDate && iterations < 36500) {
        const dateKey = toLocalISO(cursor);
        const dayData = periodGroups[dateKey] || { totalPnl: 0, portfolios: {} };
        
        equity += dayData.totalPnl;
        
        let isNewPeak = false;
        if (equity >= peak) {
            peak = equity;
            // Only mark new peak dot if there was activity (PnL != 0) or it's the very first point
            // This prevents continuous dots on flat equity lines during inactive periods
            if (dayData.totalPnl !== 0 || sortedTrades.length === 0) {
                 isNewPeak = true;
            }
        }

        const ddAmt = peak - equity;
        const ddPct = peak > 0 ? (ddAmt / peak) * 100 : 0;
        if (ddPct > maxDD) maxDD = ddPct;

        const ts = cursor.getTime();

        const point: any = {
            date: formatDate(dateKey, lang),
            fullDate: dateKey,
            timestamp: ts,
            equity: equity,
            peak: peak,
            pnl: dayData.totalPnl,
            cumulativePnl: equity - safeCapital,
            isNewPeak,
            ddPct,
            ddAmt
        };

        if (dayData.portfolios) {
            Object.keys(dayData.portfolios).forEach(pid => {
                const val = dayData.portfolios[pid];
                if (val >= 0) point[`${pid}_pos`] = val;
                else point[`${pid}_neg`] = val;
            });
        }

        curve.push(point);
        drawdown.push({ 
            date: point.date, 
            timestamp: ts, 
            ddPct: -ddPct 
        });

        // Increment cursor based on frequency
        if (frequency === 'daily') cursor.setDate(cursor.getDate() + 1);
        else if (frequency === 'weekly') cursor.setDate(cursor.getDate() + 7);
        else if (frequency === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
        else if (frequency === 'quarterly') cursor.setMonth(cursor.getMonth() + 3);
        else if (frequency === 'yearly') cursor.setFullYear(cursor.getFullYear() + 1);
        
        iterations++;
    }

    const currentEq = equity;
    const currentDD = peak > 0 ? ((peak - currentEq) / peak) * 100 : 0;

    // Calculate Period-over-Period Change (Logic Update for Dynamic Frequency)
    let periodChange = 0;
    let periodChangePct = 0;

    if (curve.length >= 2) {
        // Compare current point (end of curve) with the previous point in the generated curve
        // Since curve points are generated based on 'frequency', this automatically handles Daily/Weekly/Monthly comparison
        const prevEq = curve[curve.length - 2].equity;
        periodChange = currentEq - prevEq;
        periodChangePct = prevEq !== 0 ? (periodChange / Math.abs(prevEq)) * 100 : 0;
    } else {
        // Fallback: Compare to initial capital if only one point exists (e.g. brand new account)
        periodChange = currentEq - safeCapital;
        periodChangePct = safeCapital > 0 ? (periodChange / safeCapital) * 100 : 0;
    }

    return { 
        curve, 
        drawdown, 
        currentEq, 
        eqChange: periodChange, 
        eqChangePct: periodChangePct, 
        currentDD: currentDD, 
        maxDD: maxDD, 
        winRate: sortedTrades.length > 0 ? (wins / sortedTrades.length) * 100 : 0, 
        pf: gLoss === 0 ? (gProfit > 0 ? 999 : 0) : gProfit / gLoss, 
        riskReward: (losses > 0 && gLoss > 0) ? (gProfit/wins) / (gLoss/losses) : 0, 
        stratStats, 
        isPeak: currentEq >= peak - 0.01, 
        sharpe: 0, 
        avgWin: wins > 0 ? gProfit/wins : 0, 
        avgLoss: losses > 0 ? gLoss/losses : 0, 
        totalTrades: sortedTrades.length,
        maxStagnationDays
    };
};

export const calculateStreaks = (trades: Trade[]): Streaks => {
    const sortedTrades = [...trades].sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        const diff = timeA - timeB;
        if (diff !== 0) return diff;
        if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
        return a.id.localeCompare(b.id);
    });

    let currentWin = 0;
    let currentLoss = 0;
    let bestWin = 0;
    let tempWin = 0;

    sortedTrades.forEach(t => {
        const val = Number(t.pnl) || 0;
        if (val > 0) {
            tempWin++;
            if (tempWin > bestWin) bestWin = tempWin;
        } else {
            tempWin = 0;
        }
    });

    for (let i = sortedTrades.length - 1; i >= 0; i--) {
        const t = sortedTrades[i];
        const val = Number(t.pnl) || 0;
        
        if (val > 0) {
            if (currentLoss > 0) break; 
            currentWin++;
        } else if (val < 0) {
            if (currentWin > 0) break;
            currentLoss++;
        } else {
            break;
        }
    }

    return { currentWin, currentLoss, bestWin };
};