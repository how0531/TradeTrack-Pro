
// [Manage] Last Updated: 2024-05-22
import { Trade, Portfolio, Frequency, Metrics, StrategyStat, Lang, Streaks, EquityPoint, DrawdownPoint } from '../types';
import { formatDate } from './format';
import { isTwTradingDay } from './twHolidays';

// Helper to get start of period
const getPeriodKey = (dateStr: string, freq: Frequency): string => {
    // M3 (v3.9.0): daily 也要正規化。原本直接回傳原始 dateStr，
    // 非 YYYY-MM-DD 格式（如 '2026/04/15' 或 '2026-4-5'）的 key 會與
    // curve 迴圈用 toLocalISO 生成的 key 對不上，該筆損益從曲線無聲消失。
    if (freq === 'daily') return toLocalISO(safeDateParse(dateStr));

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

// Helper to safely parse dates cross-browser (Safari struggles with YYYY-MM-DD local time)
export const safeDateParse = (dateStr: string | undefined | null): Date => {
    if (!dateStr) return new Date();
    return new Date(dateStr.replace(/-/g, '/'));
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
    // L1 (v3.9.0): 無效日期的交易直接排除。以前它會被排序到最前面，
    // 讓 dCursor 從 Invalid Date 起跑 → while 條件 false → 整條 equity
    // 曲線塌縮成只剩 'Start' 點、currentEq 退回初始資金。
    const sortedTrades = trades
        .filter(t => !isNaN(safeDateParse(t.date).getTime()))
        .sort((a, b) => safeDateParse(a.date).getTime() - safeDateParse(b.date).getTime());

    // 3. Strategy Statistics Calculation
    const stratStats: Record<string, StrategyStat> = {};
    const uniqueStrats = [...new Set(trades.filter(t => t.strategy).map(t => t.strategy!))];

    uniqueStrats.forEach(strat => {
        const sTrades = sortedTrades.filter(t => t.strategy === strat);
        let sPnL = 0;
        let sPeak = 0;
        let sWin = 0;
        let sLoss = 0;
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
                sLoss++;
                sGrossLoss += Math.abs(val);
            }

            if (sCurrentEquity > sPeak) sPeak = sCurrentEquity;
            const currentDDAmt = sCurrentEquity - sPeak;
            if (currentDDAmt < sMinDDAmt) sMinDDAmt = currentDDAmt;
        });

        // H2 (v3.9.0): 勝率/平均虧損的分母排除 pnl=0 的平手交易。
        // 以前用 sTrades.length 當分母（含平手）、(sTrades.length - sWin) 當
        // 虧損筆數（把平手算成虧損），與 App.tsx monthlyStats 的定義矛盾。
        const sDecisive = sWin + sLoss;
        stratStats[strat] = {
            pnl: sPnL,
            trades: sTrades.length,
            winRate: sDecisive > 0 ? (sWin / sDecisive) * 100 : 0,
            mddPct: safeCapital > 0 ? (Math.abs(sMinDDAmt) / safeCapital) * 100 : 0,
            curDDPct: safeCapital > 0 ? (Math.abs(sCurrentEquity - sPeak) / safeCapital) * 100 : 0,
            isNewHigh: (sPnL >= sPeak - 0.01) && sTrades.length > 0,
            riskReward: (sLoss > 0 && sGrossLoss > 0 && sWin > 0) ? (sGrossProfit / sWin) / (sGrossLoss / sLoss) : (sGrossProfit > 0 ? Infinity : 0),
            avgWin: sWin > 0 ? sGrossProfit / sWin : 0,
            avgLoss: sLoss > 0 ? sGrossLoss / sLoss : 0
        };
    });

    // 4. Basic Stats Aggregation & Net Profit Calculation
    let wins = 0, losses = 0, gProfit = 0, gLoss = 0;
    sortedTrades.forEach(t => {
        const p = Number(t.pnl) || 0;
        if (p > 0) { wins++; gProfit += p; } else if (p < 0) { losses++; gLoss += Math.abs(p); }
    });

    const netProfit = gProfit - gLoss;
    const netProfitPct = safeCapital > 0 ? (netProfit / safeCapital) * 100 : 0;

    // --- Max Stagnation Days / Daily Returns (Sharpe) / Daily-granularity Drawdown ---
    let maxStagnationDays = 0;
    let currentStagnationStreak = 0;
    let dailyEquity = safeCapital;
    let dailyPeak = safeCapital;
    let dailyMaxDD = 0;   // M1: 以日粒度追蹤的最大回撤（不受圖表 frequency 影響）
    const dailyReturns: number[] = [];

    // H1 (v3.9.0): 分析迴圈終點尊重 endDateFilter。
    // 以前一律跑到「今天」：選歷史區間時，區間結束後的每一天都被當成
    // 報酬 0 的日子灌進 dailyReturns（稀釋 Sharpe），且停滯天數把區間後
    // 所有交易日全數計入（實測 Q1 區間顯示 300+ 天）。
    const analysisEnd = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (!endDateFilter) return today;
        const clamped = new Date(endDateFilter);
        clamped.setHours(0, 0, 0, 0);
        return clamped < today ? clamped : today;  // 未來日期仍以今天為界
    })();

    if (sortedTrades.length > 0) {
        const dailyPnlMap = new Map<string, number>();
        sortedTrades.forEach(t => {
            const dStr = toLocalISO(safeDateParse(t.date));
            dailyPnlMap.set(dStr, (dailyPnlMap.get(dStr) || 0) + (Number(t.pnl) || 0));
        });

        const dCursor = safeDateParse(sortedTrades[0].date);
        dCursor.setHours(0, 0, 0, 0);

        let safeCounter = 0;
        let prevEquity = safeCapital;

        while (dCursor <= analysisEnd && safeCounter < 11000) {
            const dStr = toLocalISO(dCursor);
            const dayPnl = dailyPnlMap.get(dStr) || 0;
            const isTradingDay = isTwTradingDay(dCursor);

            // M7 (v3.9.0): Sharpe 的報酬序列只收台股交易日，與 √252 年化係數
            // 一致。以前把週末/假日的 0 報酬也塞進序列（一年 ~365 筆）卻用
            // √252 年化，系統性低估約 17%。非交易日若有真實損益（手動輸入的
            // 海外/加密交易）仍計入，避免遺漏。
            if (prevEquity > 0 && (isTradingDay || dayPnl !== 0)) {
                dailyReturns.push(dayPnl / prevEquity);
            }

            dailyEquity += dayPnl;
            prevEquity = dailyEquity;

            if (dailyEquity > dailyPeak) {
                dailyPeak = dailyEquity;
                currentStagnationStreak = 0;
            } else if (isTradingDay) {
                // 僅在台股交易日累加未創高天數 — 排除週末 + TWSE 公告國定假日
                currentStagnationStreak++;
            }

            if (currentStagnationStreak > maxStagnationDays) {
                maxStagnationDays = currentStagnationStreak;
            }

            // M1: 日粒度回撤 — 統計卡與風控警戒用這個值，
            // 不再隨圖表 frequency 切到 Monthly 就被期內淨額抵銷歸零。
            if (dailyPeak > 0) {
                const ddPctDaily = ((dailyPeak - dailyEquity) / dailyPeak) * 100;
                if (ddPctDaily > dailyMaxDD) dailyMaxDD = ddPctDaily;
            }

            dCursor.setDate(dCursor.getDate() + 1);
            safeCounter++;
        }
    }

    // 日粒度的當前回撤（供統計卡與 App.tsx 回撤警戒使用）
    const dailyCurrentDD = dailyPeak > 0 ? ((dailyPeak - dailyEquity) / dailyPeak) * 100 : 0;

    // Calculate Sharpe Ratio
    let sharpe = 0;
    if (dailyReturns.length > 1) {
        const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (dailyReturns.length - 1);
        const stdDev = Math.sqrt(variance);

        if (stdDev > 0) {
            // 序列現在只含交易日（M7），√252 年化係數與序列頻率一致
            sharpe = (mean / stdDev) * Math.sqrt(252);
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

    const curve: EquityPoint[] = [];
    const drawdown: DrawdownPoint[] = [];

    let equity = safeCapital;
    let peak = safeCapital;
    let maxDD = 0;

    // B. Determine Timeline Range
    // Start: Period of first trade OR Today if no trades
    const firstTradeDate = sortedTrades.length > 0 ? safeDateParse(sortedTrades[0].date) : new Date();
    // Align to period start
    let cursor = new Date(getPeriodKey(toLocalISO(firstTradeDate), frequency).replace(/-/g, '/'));

    // End: Period of analysisEnd (H1: 尊重 endDateFilter；無 filter 時為今天)
    // 以前寫死今天：選歷史區間時曲線多出一條延伸到今天的平坦尾巴。
    const endDateStr = getPeriodKey(toLocalISO(analysisEnd), frequency);
    const endDate = new Date(endDateStr.replace(/-/g, '/'));

    // C. Add Anchor Point (One period before start)
    const anchor = new Date(cursor.getTime());
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

        const point: EquityPoint = {
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
        netProfit,
        netProfitPct,
        // M1 (v3.9.0): 回傳日粒度的回撤數字。curve 迴圈算的 maxDD 是
        // per-frequency（畫圖用），切到 Monthly 時期內回撤被淨額抵銷 —
        // 統計卡顯示 0%、App.tsx 回撤警戒不觸發。統計數字改用 daily 粒度，
        // 與圖表 frequency 解耦；沒有交易時退回 frequency 版本（都是 0）。
        currentDD: sortedTrades.length > 0 ? dailyCurrentDD : currentDD,
        maxDD: sortedTrades.length > 0 ? dailyMaxDD : maxDD,
        // H2 (v3.9.0): 勝率分母排除平手（與 App.tsx monthlyStats 定義一致）
        winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
        pf: gLoss === 0 ? (gProfit > 0 ? Infinity : 0) : gProfit / gLoss,
        riskReward: (losses > 0 && gLoss > 0 && wins > 0) ? (gProfit / wins) / (gLoss / losses) : (wins > 0 ? Infinity : 0),
        stratStats,
        isPeak: currentEq >= peak - 0.01,
        sharpe,
        avgWin: wins > 0 ? gProfit / wins : 0,
        avgLoss: losses > 0 ? gLoss / losses : 0,
        totalTrades: sortedTrades.length,
        maxStagnationDays,
        expectancy: sortedTrades.length > 0 ? netProfit / sortedTrades.length : 0
    };
};

export const calculateStreaks = (trades: Trade[]): Streaks => {
    const sortedTrades = [...trades].sort((a, b) => {
        const timeA = safeDateParse(a.date).getTime();
        const timeB = safeDateParse(b.date).getTime();
        const diff = timeA - timeB;
        if (diff !== 0) return diff;
        if (a.timestamp && b.timestamp) return a.timestamp.localeCompare(b.timestamp);
        return a.id.localeCompare(b.id);
    });

    let currentWin = 0;
    let currentLoss = 0;
    let bestWin = 0;
    let tempWin = 0;

    // M6 (v3.9.0): 平手（pnl=0）交易不打斷連勝/連敗計數。
    // 以前一筆 scratch 單就把 currentLoss 歸零 — 連虧 5 筆的風控警戒
    // 被一筆平手單解除，違反風控本意。平手改為「跳過」。
    sortedTrades.forEach(t => {
        const val = Number(t.pnl) || 0;
        if (val > 0) {
            tempWin++;
            if (tempWin > bestWin) bestWin = tempWin;
        } else if (val < 0) {
            tempWin = 0;
        }
        // val === 0：跳過，不重置
    });

    for (let i = sortedTrades.length - 1; i >= 0; i--) {
        const t = sortedTrades[i];
        const val = Number(t.pnl) || 0;

        if (val === 0) continue;  // 平手不計入也不打斷

        if (val > 0) {
            if (currentLoss > 0) break;
            currentWin++;
        } else {
            if (currentWin > 0) break;
            currentLoss++;
        }
    }

    return {
        currentWin,
        currentLoss,
        bestWin,
        bestLoss: 0, // TODO: Calculate if needed
        maxWin: bestWin, // Alias for bestWin
        maxLoss: 0 // TODO: Calculate if needed
    };
};
