import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  MessageSquare,
  MonitorCheck,
  Power,
  RefreshCw,
  ShieldCheck,
  Wifi,
  Zap,
  Activity,
  X,
} from "lucide-react";
import { Trade, BrokerConfig, Portfolio, AutoSyncParams } from "../../types";
import {
  fetchBrokerPnl,
  fetchBrokerProfile,
} from "../../services/brokerService";
import { onBackendStatusChange, getBackendStatus, wakeUpBackendViaGateway } from '../../services/backendGateway';
import { getLocalDateStr, formatDateWithWeekday } from "../../utils/format";
import { formatSymbolCode } from "../../utils/symbolNames";
import { CustomDateRangeModal } from "./CustomDateRangeModal";
import { useClickOutside } from "../../hooks/useClickOutside";
// No imports needed from SettingsView here
import { GlassSelect } from "../common/GlassSelect";
import { ACCOUNT_CATEGORY_THEMES } from '../../constants';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useTradeContext } from "../../context/TradeContext";
import { useBackend } from "../../context/BackendContext";
import { getCache, setCache } from "../../utils/cache";

// --- Interfaces ---
interface SyncDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (trades: Trade[]) => void;
  lang?: "zh" | "en";
  existingTrades?: Trade[];
  autoSyncParams?: AutoSyncParams | null;
  onAutoSyncComplete?: () => void;
}

// --- Internal Component: GlassSelect Moved to common/GlassSelect.tsx ---

// --- Constants & Animations ---
const NEBULA_THEMES: Record<string, { flare1: string; flare2: string; pulse: string }> = {
  online: {
    flare1: "bg-[#C8B085]/10",
    flare2: "bg-[#D05A5A]/5",
    pulse: "animate-[pulse_8s_ease-in-out_infinite]"
  },
  sleeping: {
    flare1: "bg-[#50C8FF]/15",
    flare2: "bg-[#7042FF]/10",
    pulse: "animate-[pulse_4s_ease-in-out_infinite]"
  },
  checking: {
    flare1: "bg-white/10",
    flare2: "bg-zinc-500/5",
    pulse: "animate-pulse"
  },
  offline: {
    flare1: "bg-red-500/10",
    flare2: "bg-orange-500/5",
    pulse: "animate-[pulse_2s_ease-in-out_infinite]"
  }
};

export const SyncDateModal: React.FC<SyncDateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = "zh",
  existingTrades = [],
  autoSyncParams,
  onAutoSyncComplete
}) => {
  // --- Context ---
  const { availableStrategies, availableEmotions, portfolios } = useTradeContext();

  // --- State ---
  const [step, setStep] = useState<1 | 2>(1);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const { status: backendStatus, wake: handleManualPing } = useBackend();
  const [resultMsg, setResultMsg] = useState("");

  // Dates
  const today = getLocalDateStr(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showApiHelper, setShowApiHelper] = useState(false);

  // Data
  const [configs, setConfigs] = useState<BrokerConfig[]>([]);
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);
  // REMOVED: const [portfolios, setPortfolios] = useState<Portfolio[]>([]); // Use Context
  const [targetPortfolioId, setTargetPortfolioId] = useState<string>("");
  const [transactions, setTransactions] = useState<any[]>([]); // Need Trade type + selected
  const [autoMerge, setAutoMerge] = useLocalStorage("sync_auto_merge", false);

  // New: Map specific broker accounts to specific portfolios
  // Key: uniqueKey (configId|code|idx), Value: portfolioId
  // New: Map specific broker accounts to specific portfolios
  // Key: uniqueKey (configId|code|idx), Value: portfolioId
  // Use persistent storage so defaults are remembered
  const [accountPortfolioMap, setAccountPortfolioMap] = useLocalStorage<Record<string, string>>("account_portfolio_map_v2", {});

  // 🎨 視覺回饋優化
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showMapping, setShowMapping] = useState(false);

  // --- Effects ---
  useEffect(() => {
    if (isOpen) {
      // ✅ 樂觀更新策略:立即顯示快取資料,背景驗證
      loadConfigsWithOptimisticUpdate();

      // Auto-select first portfolio if none selected
      if (!targetPortfolioId && portfolios.length > 0) {
        setTargetPortfolioId(portfolios[0].id);
      }
    } else {
      // Reset
      setStep(1);
      setStatus("idle");
      setTransactions([]);
    }

  }, [isOpen, portfolios]);

  // Auto-Sync Execution
  useEffect(() => {
    if (isOpen && autoSyncParams && !autoSyncParams.executed && configs.length > 0) {
      console.log("🤖 [SyncModal] Auto-Sync Triggered", autoSyncParams);

      // 1. Map Accounts
      const targetIds: string[] = [];
      const targets = autoSyncParams.accounts;

      configs.forEach(c => {
        const branches = (c.branch || '').split(',');
        const codes = (c.branchCode || '').split(',');
        branches.forEach((bRaw, idx) => {
          const bCode = codes[idx] || '';
          const uniqueKey = `${c.id}|${bCode}|${idx}`;

          // Smart Match: Check if target (F002, 9A9J) exists in branch string or code
          const isCodeMatch = targets.some(tgt => bCode.toUpperCase().includes(tgt.toUpperCase()));
          const isNameMatch = targets.some(tgt => bRaw.toUpperCase().includes(tgt.toUpperCase()));
          const isTypeMatch = (bRaw.includes('期貨') && targets.includes('F')) || (!bRaw.includes('期貨') && targets.includes('S'));

          if (isCodeMatch || isNameMatch || isTypeMatch) {
            targetIds.push(uniqueKey);
          }
        });
      });

      if (targetIds.length > 0) {
        // 2. Update UI State (for visual feedback)
        setStartDate(autoSyncParams.start);
        setEndDate(autoSyncParams.end);
        setSelectedConfigIds(targetIds);

        // 3. Force Execution immediately with explicit params
        handleFetch(autoSyncParams.start, autoSyncParams.end, targetIds);

        // 4. Mark Complete to prevent loops
        if (onAutoSyncComplete) onAutoSyncComplete();
      } else {
        console.warn("🤖 [SyncModal] No matching accounts found for auto-sync.");
      }
    }
  }, [isOpen, configs, autoSyncParams]);

  // --- Handlers ---

  /**
   * ✅ 樂觀更新策略載入帳號設定
   * 1. 立即顯示快取資料 (如果有)
   * 2. 背景驗證並靜默更新
   */
  const loadConfigsWithOptimisticUpdate = async () => {
    try {
      // 1. 先嘗試從快取載入 (TTL 5 分鐘)
      const cachedConfigs = getCache<BrokerConfig[]>("broker_configs_cache");

      // 2. 立即顯示快取資料
      let initialConfigs: BrokerConfig[] = [];
      if (cachedConfigs && cachedConfigs.length > 0) {
        console.log("✅ 使用快取資料,立即顯示");
        initialConfigs = cachedConfigs;
        setConfigs(cachedConfigs);
        // ✅ 修復：預設全選所有帳號分支（避免每次只選第一個導致結果不一致）
        const allKeys: string[] = [];
        cachedConfigs.forEach(c => {
          const codes = (c.branchCode || '').split(',');
          codes.forEach((code, idx) => {
            allKeys.push(`${c.id}|${code.trim()}|${idx}`);
          });
        });
        setSelectedConfigIds(allKeys);
      } else {
        // 3. 沒有快取,從 localStorage 載入完整設定
        const savedConfigs = localStorage.getItem("broker_configs");
        if (savedConfigs) {
          const parsed = JSON.parse(savedConfigs);
          initialConfigs = parsed;
          setConfigs(parsed);
          // ✅ 修復：預設全選所有帳號分支
          const allKeys: string[] = [];
          parsed.forEach((c: BrokerConfig) => {
            const codes = (c.branchCode || '').split(',');
            codes.forEach((code: string, idx: number) => {
              allKeys.push(`${c.id}|${code.trim()}|${idx}`);
            });
          });
          setSelectedConfigIds(allKeys);
          // 存入快取供下次使用
          setCache("broker_configs_cache", parsed, 5 * 60 * 1000);
        }
      }

      // 4. REMOVED: Portfolios are now managed by Context. 
      //    We rely on 'portfolios' from useTradeContext() which is reactive.

      // 5. Backend check is now handled globally by BackendContext
    } catch (e) {
      console.error("Error loading configs", e);
    }
  };

  const toggleConfigSelection = (id: string, code: string, idx: number) => {
    // Unique key: configId|branchCode|subIndex
    // Use subIndex to differentiate if codes are missing or duplicate
    const key = `${id}|${code}|${idx}`;
    setSelectedConfigIds((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  const formatMoney = (val: number) => val.toLocaleString();

  const updateTxField = (id: string, field: string, val: any) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t)),
    );
  };

  const toggleSelection = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)),
    );
  };

  // 🎨 真實階段式載入動畫 (由 handleFetch 控制)
  // Removed fake startLoadingAnimation/stopLoadingAnimation

  const handleFetch = async (overrideStart?: string, overrideEnd?: string, overrideIds?: string[]) => {
    const totalStartTime = performance.now();

    // Determine effective values (Override or State)
    const effectiveStart = overrideStart || startDate;
    const effectiveEnd = overrideEnd || endDate;
    const effectiveIds = overrideIds || selectedConfigIds;

    console.log("🚀 [PERF] ===== 開始擷取券商資料 =====");
    console.log("🕐 [PERF] 開始時間:", new Date().toISOString());
    console.log(`📅 [DEBUG] 前端請求參數: Start=${effectiveStart}, End=${effectiveEnd}`);

    // Validate Date (Prevent frontend state issues)
    if (!effectiveStart || !effectiveEnd) {
      setResultMsg("日期範圍錯誤，請重新選擇");
      return;
    }

    if (effectiveIds.length === 0) {
      setResultMsg("請至少選擇一個券商帳號");
      return;
    }

    setStatus("loading");
    setResultMsg("");

    // 🟢 Status Sync: Set to 'checking' (Yellow) or 'online' (Green) to prevent "OFFLINE" contradiction
    // If we are starting a fetch, we assume we are trying to be online.
    // (Handled globally by BackendContext now)

    // 🎨 啟動真實進度顯示 (Initial State)
    setLoadingProgress(10);
    setLoadingMessage("正在準備帳號設定...");

    try {
      const step1Start = performance.now();
      if (effectiveIds.length === 0) throw new Error("請選擇帳號");
      console.log(
        `✅ [PERF] 步驟1 - 帳號設定確認: ${(performance.now() - step1Start).toFixed(0)}ms`,
      );

      // 呼叫後端 (支援多帳號合併、篩選)
      console.log("📞 [PERF] 步驟2 - 準備呼叫後端 API...");
      setLoadingProgress(30);
      setLoadingMessage("正在登入券商 API...");
      const step2Start = performance.now();
      // 🛡️ FIX: Safari 日期時區修正 — 用 '/' 分隔符強制本地時間解析
      const startD = new Date(effectiveStart.replace(/-/g, '/'));
      const endD = new Date(effectiveEnd.replace(/-/g, '/'));

      // Group selections by (Config ID + Target Portfolio ID)
      // ✅ 不再區分 S/F 類型，一次查詢所有帳號類型
      const fetchGroups = new Map<string, { config: BrokerConfig, codes: Set<string>, targetPid: string, configId: string }>();

      console.log('🔍 [DEBUG] Selected Config IDs:', effectiveIds);
      console.log('🔍 [DEBUG] Account Portfolio Map:', accountPortfolioMap);
      console.log('🔍 [DEBUG] Default Target Portfolio:', targetPortfolioId);

      effectiveIds.forEach(key => {
        const [confId, code, subIdxStr] = key.split('|');
        const subIdx = parseInt(subIdxStr || '0', 10);
        const original = configs.find(c => c.id === confId);

        if (!original) return;

        const allBranches = (original.branch || '').split(',');
        const specificBranchName = allBranches[subIdx] || '';

        // Display Name for Progress
        const progressName = specificBranchName || original.branch || '帳戶';

        console.log(`🔍 [DEBUG] Account ${key} -> Branch: "${specificBranchName}"`);

        // Determine target portfolio: mapped specific > global target
        let targetPid = accountPortfolioMap[key];

        // 🧠 Smart Auto-Detection:
        // If no explicit mapping exists, try to guess based on branch name
        if (!targetPid) {
          // Smart auto-detect: futures accounts → 期貨 portfolio
          const isFuturesAccount = specificBranchName.includes('期貨') || specificBranchName.includes('Futures');
          if (isFuturesAccount) {
            const futuresPortfolio = portfolios.find(p => p.name.includes('期貨') || p.name.includes('Futures'));
            if (futuresPortfolio) {
              targetPid = futuresPortfolio.id;
              setAccountPortfolioMap(prev => ({ ...prev, [key]: futuresPortfolio.id }));
            }
          }
        }

        // Fallback to default if still null
        if (!targetPid) targetPid = targetPortfolioId;

        // Group by config + targetPid (不再分 S/F 類型)
        const groupKey = `${confId}|${targetPid}`;
        if (!fetchGroups.has(groupKey)) {
          fetchGroups.set(groupKey, {
            config: original,
            codes: new Set(),
            targetPid: targetPid,
            configId: original.id,
          });
        }
        if (code && code !== 'undefined') {
          fetchGroups.get(groupKey)!.codes.add(code);
        }
      });

      let mergedDetails: any[] = [];
      const totalGroups = fetchGroups.size;
      let completedGroups = 0;
      let anyCaNotActivated = false;
      const fetchErrors: string[] = []; // C3: 累積每個 group 的錯誤訊息

      // Iterate and fetch for each group
      for (const [key, group] of fetchGroups) {
        const { config, codes, targetPid, configId } = group;
        const filterCodeStr = Array.from(codes).join(',');

        console.log(`🌐 [DEBUG] Fetching for Config: ${config.id}, TargetPID: ${targetPid}, FilterCodes: ${filterCodeStr}`);

        // Dynamic progress based on group processing
        completedGroups++;
        const progressPct = 30 + Math.floor((completedGroups / totalGroups) * 50); // 30% -> 80%
        setLoadingProgress(progressPct);

        // Contextual loading message
        const allBranches = (config.branch || '帳戶').split(',');
        const allCodes = (config.branchCode || '').split(',').map(c => c.trim());

        // Find the first selected code's name
        const firstSelectedCode = Array.from(codes)[0];
        const selectedIdx = allCodes.indexOf(firstSelectedCode);
        let firstBranchName = selectedIdx >= 0 ? allBranches[selectedIdx] : allBranches[0];

        // Clean up the name by removing parentheses and trimming (e.g., "板新(台股)" -> "板新")
        firstBranchName = (firstBranchName || '帳戶').replace(/\(.*\)/g, '').trim();
        if (!firstBranchName) firstBranchName = '帳戶';

        const branchSuffix = codes.size > 1 ? '等多筆' : '';

        setLoadingMessage(`正在同步 ${firstBranchName}${branchSuffix}...`);

        const requestConfig = { ...config, branchCode: filterCodeStr };

        try {
          // Fetch
          const result = await fetchBrokerPnl(startD, endD, requestConfig, (chunkCurrent, chunkTotal, startStr, endStr) => {
             // For each chunk, update progress more finely
             // The overall progress for groups is between 30% and 80%
             const baseProgress = 30 + Math.floor(((completedGroups - 1) / totalGroups) * 50);
             const chunkProgress = Math.floor((chunkCurrent / chunkTotal) * (50 / totalGroups));
             setLoadingProgress(baseProgress + chunkProgress);
             setLoadingMessage(`正在下載 ${firstBranchName}${branchSuffix} 的交易資料...`);
          });
          console.log(`✅ [DEBUG] Fetch Success: ${key} -> ${result.details?.length || 0} trades`);

          if (result.emptyReason === 'ca_not_activated') {
            anyCaNotActivated = true;
          }

          // Assign Portfolio ID immediately
          if (result.details) {
            const taggedDetails = result.details.map(d => ({
              ...d,
              portfolioId: targetPid, // Override with specific target
              configId: configId, // Track source config for reactive updates
              sourceKey: key,     // CRITICAL: Track the EXACT source key to separate Futures/Stock mappings
              selected: true,
              isDuplicate: false
            }));
            mergedDetails.push(...taggedDetails);
          }
        } catch (err: any) {
          const errMsg = err?.message || '未知錯誤';
          console.error(`❌ [DEBUG] Fetch Failed for ${key}:`, err);
          fetchErrors.push(`${firstBranchName}${branchSuffix}: ${errMsg}`);
        }
      }

      // If we are online after fetching, set status to online
      // (Handled via BackendContext)

      console.log(
        `✅ [PERF] 步驟2 - API 呼叫完成: ${(performance.now() - step2Start).toFixed(0)}ms`,
      );

      // 模擬 Result Object 供後續處理
      // We manually construct result object because we might have merged from multiple sources
      const result = { details: mergedDetails, totalPnl: 0, dailyResults: [] };

      // 處理結果
      console.log(
        `🔄 [PERF] 步驟3 - 開始處理 ${result.details.length} 筆交易資料...`,
      );
      setLoadingProgress(85);
      setLoadingMessage("正在處理資料...");
      const step3Start = performance.now();
      let processedTrades = result.details.map((d, i) => {
        // Base transformation
        const isFuture = d.category === '期貨';
        const unit = isFuture ? '口' : '張';
        // Shioaji 原生回傳的 quantity 單位：期貨為口，台股為張 (Unit.Common)，直接取用即可
        const qtyValue = d.quantity;
        const sheets = Math.abs(qtyValue).toFixed(0);

        // Calculate dynamic yield if not provided but buyAmt exists
        let yieldPct = d.yield || 0;
        if (!yieldPct && d.buyAmt > 0) {
          yieldPct = Number((d.pnl / d.buyAmt * 100).toFixed(2));
        }

        const yieldStr = yieldPct !== 0
          ? `${yieldPct > 0 ? "+" : ""}${yieldPct}%`
          : "0%";

        // 🔧 FIX: Better display for futures (Points instead of %)
        let noteValue = yieldStr;
        if (isFuture) {
          const entry = d.entryPrice || 0;
          const exit = d.exitPrice || 0;
          const absQty = Math.abs(d.quantity || 1) / 1; // futures qty

          if (entry > 0 && exit > 0) {
            const diff = Math.abs(exit - entry);
            const totalPts = Number((diff * absQty).toFixed(2));
            noteValue = `${d.pnl >= 0 ? '+' : '-'}${totalPts} pts`;
          } else if (d.yield && d.yield !== 0) {
            const yieldVal = Number(d.yield);
            const y = yieldVal.toFixed(2);
            noteValue = `${yieldVal > 0 ? "+" : ""}${y}%`;
          } else {
            const code = d.code || '';
            let multiplier = 200;
            if (code.includes('MTX') || code.includes('小台')) multiplier = 50;
            else if (code.includes('TE') || code.includes('電子')) multiplier = 4000;
            else if (code.includes('TF') || code.includes('金融')) multiplier = 1000;
            else if (code.includes('XIF') || code.includes('東證')) multiplier = 200;
            else if (code.includes('GTF') || code.includes('黃金')) multiplier = 100;

            const totalDerivedPts = Math.abs(d.pnl) / multiplier;

            if (totalDerivedPts > 0) {
              noteValue = `${d.pnl >= 0 ? '+' : '-'}${Number(totalDerivedPts.toFixed(0))} pts`;
            } else {
              noteValue = '0 pts';
            }
          }
        }

        // 🔧 STABLE ID logic
        const stockCode = d.code ? d.code.split(' ')[0].trim() : 'UNKNOWN';
        if (!stockCode || stockCode === '') {
          console.warn(`⚠️ [ID生成] 交易缺少有效 code 欄位:`, { date: d.date, pnl: d.pnl, originalCode: d.code });
        }

        const orderNo = d.orderNo || '';
        const isValidOrderNo = orderNo &&
          !orderNo.startsWith('unknown-') &&
          orderNo.trim() !== '' &&
          orderNo !== 'unknown';

        // Normalize date to YYYY-MM-DD
        const normalizedDate = (d.date || '').replace(/[\.\/]/g, '-');

        let stableId: string;
        if (isValidOrderNo) {
          stableId = `${orderNo}-${normalizedDate}-${stockCode}`;
        } else {
          const contentKey = `${normalizedDate}_${stockCode}_${d.pnl.toFixed(2)}_${d.quantity}_${Number(d.price).toFixed(4)}`;
          stableId = `tx-${contentKey}`;
        }

        return {
          id: stableId,
          date: normalizedDate,
          orderNo: d.orderNo || `unknown-${i}`,
          code: d.code,
          pnl: d.pnl,
          price: d.price,
          quantity: d.quantity,
          side: d.quantity > 0 ? "Buy" : "Sell",
          selected: true,
          isDuplicate: false,
          duplicateReason: "",
          portfolioId: (d as any).portfolioId || targetPortfolioId,
          strategy: "",
          emotion: "",
          note: `${d.code} | ${noteValue} | ${sheets}${unit}`.trim(),
          showNoteInput: false,
          raw_yield: yieldPct,
          category: d.category,
          configId: (d as any).configId,
          sourceKey: (d as any).sourceKey,
          entryPrice: d.entryPrice,
          exitPrice: d.exitPrice,
          points: noteValue
        };
      });

      // 1. 合併分筆交易整合 (Aggregation)
      if (autoMerge) {
        const groupedMap = new Map<string, (typeof processedTrades)[0]>();

        processedTrades.forEach((trade) => {
          const stockCode = trade.code.split(" ")[0];
          const orderNo = trade.orderNo;

          if (!orderNo || orderNo.startsWith("unknown")) {
            groupedMap.set(trade.id, trade);
            return;
          }

          const compositeKey = `${orderNo}_${stockCode}`;

          if (groupedMap.has(compositeKey)) {
            const existing = groupedMap.get(compositeKey)!;
            const totalQty = existing.quantity + trade.quantity;
            const avgPrice =
              totalQty !== 0
                ? (existing.price * existing.quantity +
                  trade.price * trade.quantity) /
                totalQty
                : existing.price;

            existing.quantity = totalQty;
            existing.price = avgPrice;
            existing.pnl += trade.pnl;

            if (existing.entryPrice && trade.entryPrice) {
              existing.entryPrice = ((existing.entryPrice * existing.quantity) + (trade.entryPrice * trade.quantity)) / totalQty;
            }
            if (existing.exitPrice && trade.exitPrice) {
              existing.exitPrice = ((existing.exitPrice * existing.quantity) + (trade.exitPrice * trade.quantity)) / totalQty;
            }

            const isFuture = existing.category === '期貨';
            const unit = isFuture ? '口' : '張';
            const mergedQtyValue = isFuture ? Math.abs(totalQty) : Math.abs(totalQty / 1000);
            const mergedSheets = mergedQtyValue.toFixed(0);

            const noteParts = existing.note.split("|");

            if (isFuture && noteParts.length >= 2) {
              let newPtsStr = noteParts[1].trim();

              if (existing.pnl !== 0) {
                const code = existing.code.toUpperCase();
                let multiplier = 200;
                if (code.includes('MTX') || code.includes('小台')) multiplier = 50;
                else if (code.includes('TE') || code.includes('電子')) multiplier = 4000;
                else if (code.includes('TF') || code.includes('金融')) multiplier = 1000;
                else if (code.includes('XIF') || code.includes('東證')) multiplier = 200;
                else if (code.includes('GTF') || code.includes('黃金')) multiplier = 100;

                const totalDerivedPts = Number((Math.abs(existing.pnl) / multiplier).toFixed(2));
                newPtsStr = `${existing.pnl >= 0 ? '+' : '-'}${totalDerivedPts} pts`;
              }

              existing.note = `${noteParts[0]} | ${newPtsStr} | ${mergedSheets}${unit}`.trim();

            } else if (noteParts.length >= 2) {
              existing.note =
                `${noteParts[0]} | ${noteParts[1]} | ${mergedSheets}${unit}`.trim();
            }
          } else {
            groupedMap.set(compositeKey, trade);
          }
        });

        processedTrades = Array.from(groupedMap.values());
      }

      // 2. 重複交易檢測 (與現有交易比對)
      // 判斷標準優先序：
      //   方法A: orderNo 完全相同 (最準確，券商唯一單號)
      //   方法B: 同日期 + 同標的代號 + 同損益 (±1 容差)
      //          qty/price 僅在「兩邊都有非零值」時才加入比對，避免舊資料缺欄位導致誤判
      processedTrades = processedTrades.map((trade) => {
        let isDup = false;
        let dupReason = "";

        if (existingTrades && existingTrades.length > 0) {
          const tradeStockCode = trade.code ? trade.code.split(" ")[0].trim() : '';

          if (!tradeStockCode) {
            console.warn(`⚠️ [重複檢測] 跳過無效 code:`, { date: trade.date, pnl: trade.pnl });
            return { ...trade, isDuplicate: false, duplicateReason: "", selected: true };
          }

          const match = existingTrades.find((e) => {
            // --- 方法A: orderNo 比對 ---
            if (trade.orderNo && e.orderNo && trade.orderNo === e.orderNo) {
              return true;
            }

            // --- 方法B: 日期 + 代號 + 損益 主要比對 ---
            const sameDate = e.date === trade.date;
            if (!sameDate) return false;

            // 代號比對：優先用 code 欄位，備援用 note
            let sameCode = false;
            if (e.code && trade.code) {
              const eCode = e.code.split(' ')[0].trim();
              const tCode = trade.code.split(' ')[0].trim();
              sameCode = !!(eCode && tCode && eCode === tCode);
            } else if (e.note && tradeStockCode) {
              sameCode = new RegExp(`\\b${tradeStockCode}\\b`).test(e.note);
            }
            if (!sameCode) return false;

            // 損益比對 (±2 容差，容錯手續費差異)
            const samePnl = Math.abs((e.pnl ?? 0) - (trade.pnl ?? 0)) < 2;
            if (!samePnl) return false;

            // 數量/價格：僅當兩邊都有非零值時才要求相符
            const eQty = e.quantity ?? 0;
            const tQty = trade.quantity ?? 0;
            if (eQty !== 0 && tQty !== 0 && Math.abs(eQty - tQty) >= 0.001) return false;

            const ePrice = e.price ?? 0;
            const tPrice = trade.price ?? 0;
            if (ePrice !== 0 && tPrice !== 0 && Math.abs(ePrice - tPrice) >= 0.01) return false;

            return true;
          });

          if (match) {
            isDup = true;
            const method = match.orderNo && trade.orderNo && match.orderNo === trade.orderNo
              ? 'orderNo'
              : '日期+代號+損益';
            dupReason = `偵測到重複 [${tradeStockCode}] — 比對方式: ${method}`;
            console.log(`🔍 [重複檢測] 命中:`, { date: trade.date, code: tradeStockCode, pnl: trade.pnl, method });
          } else {
            const nearMatch = existingTrades.find(e => {
              if (e.date !== trade.date) return false;
              const eCode = (e.code || '').split(' ')[0].trim();
              const tCode = tradeStockCode;
              return eCode === tCode;
            });
            if (nearMatch) {
              console.warn(`⚠️ [重複檢測] 代號相同但損益不符:`, {
                date: trade.date, code: tradeStockCode,
                incoming_pnl: trade.pnl, existing_pnl: nearMatch.pnl,
                diff: Math.abs(trade.pnl - nearMatch.pnl)
              });
            }
          }
        }

        return { ...trade, isDuplicate: isDup, duplicateReason: dupReason, selected: !isDup };
      });
      console.log(
        `✅ [PERF] 步驟3 - 資料處理完成: ${(performance.now() - step3Start).toFixed(0)}ms`,
      );

      setTransactions(processedTrades);
      setStatus("idle");

      // C3: 顯示有意義的錯誤訊息而非空白的「查無交易紀錄」
      if (processedTrades.length === 0) {
        if (fetchErrors.length > 0) {
          // 有 API 錯誤才是真正的問題
          setResultMsg(`同步失敗：${fetchErrors.join('；')}`);
        } else if (anyCaNotActivated) {
          setResultMsg("⚠️ 憑證未啟動或已失效，無法取得損益。請至「設定」重新上傳 .pfx 檔案。");
        } else {
          setResultMsg(`此區間（${effectiveStart} ~ ${effectiveEnd}）查無交易紀錄。請確認券商帳號是否有未平倉或已實作損益。`);
        }
        setStep(2);
      } else {
        if (fetchErrors.length > 0) {
          // 部分成功、部分失敗
          setResultMsg(`⚠️ 部分帳號同步失敗：${fetchErrors.join('；')}`);
        }
        setStep(2);
      }

      const totalElapsed = performance.now() - totalStartTime;
      console.log("🎉 [PERF] ===== 券商資料擷取完成 =====");
      console.log(
        `⏱️  [PERF] 總耗時: ${totalElapsed.toFixed(0)}ms (${(totalElapsed / 1000).toFixed(2)}s)`,
      );
    } catch (e: any) {
      console.error("Fetch Error:", e);
      setStatus("error");
      setResultMsg(e.message || "同步失敗，請確認後端連線或憑證");
    }
  };

  const handleConfirmImport = () => {
    const finalTrades = transactions.filter((t) => t.selected);
    if (onSuccess) onSuccess(finalTrades);
    onClose();
  };

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const currentTheme = NEBULA_THEMES[backendStatus] || NEBULA_THEMES.checking;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0B0F]/85 backdrop-blur-2xl animate-in fade-in duration-300 p-4 overflow-hidden font-inter">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(12px) rotate(0deg); opacity: 0.2; }
          50% { opacity: 1; }
          100% { transform: rotate(360deg) translateX(12px) rotate(-360deg); opacity: 0.2; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes stagger-in {
          0% { opacity: 0; transform: translateY(12px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        @keyframes pulse-ring-outer {
          0% { transform: scale(0.6); opacity: 0.3; }
          60% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(0.6); opacity: 0; }
        }
        @keyframes shimmer-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        .stagger-1 { animation: stagger-in 0.6s cubic-bezier(.16,1,.3,1) forwards 0.1s; opacity: 0; }
        .stagger-2 { animation: stagger-in 0.6s cubic-bezier(.16,1,.3,1) forwards 0.25s; opacity: 0; }
        .stagger-3 { animation: stagger-in 0.6s cubic-bezier(.16,1,.3,1) forwards 0.4s; opacity: 0; }
        .stagger-4 { animation: stagger-in 0.6s cubic-bezier(.16,1,.3,1) forwards 0.55s; opacity: 0; }
      `}} />

      {/* Ambient Background Flares (Dynamic) */}
      <div className={`absolute top-[-10%] left-[-10%] w-[60%] h-[60%] ${currentTheme.flare1} rounded-full blur-[140px] pointer-events-none transition-all duration-1000 ${currentTheme.pulse}`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] ${currentTheme.flare2} rounded-full blur-[120px] pointer-events-none transition-all duration-1000 ${currentTheme.pulse}`} />

      <div
        className={`relative w-full ${step === 2 ? "max-w-4xl" : "max-w-md"} max-h-[90vh] bg-[#14161B]/90 rounded-[40px] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-500 flex flex-col my-auto overflow-hidden animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02] rounded-t-3xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw
              size={14}
              className={status === "loading" ? "animate-spin" : ""}
            />
            {step === 1 ? "匯入設定" : <span className="flex items-center gap-2">交易檢核 <span className="text-[10px] font-mono text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{startDate.replace(/\d{4}\./, '')}-{endDate.replace(/\d{4}\./, '')}</span></span>}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="p-7 overflow-y-auto custom-scrollbar flex-1">

          {/* ====== FULL-SCREEN SLEEPING OVERLAY ====== */}
          {step === 1 && backendStatus === 'sleeping' && status !== 'loading' && (
            <div className="flex flex-col items-center justify-center py-10 gap-8 animate-in fade-in zoom-in-95 duration-500">
              {/* Concentric Pulse Rings */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-blue-400/30 animate-[pulse-ring_3s_ease-out_infinite]" />
                <div className="absolute inset-[-12px] rounded-full border border-blue-500/15 animate-[pulse-ring-outer_3.5s_ease-out_infinite_0.5s]" />
                <div className="absolute inset-[-24px] rounded-full border border-indigo-500/10 animate-[pulse-ring-outer_4s_ease-out_infinite_1s]" />
                <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-blue-500/20 to-indigo-600/10 border border-blue-400/20 flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.15)] backdrop-blur-xl">
                  <Zap size={28} className="text-blue-400 animate-[breathe_2s_ease-in-out_infinite]" />
                </div>
              </div>

              {/* Status Text */}
              <div className="text-center space-y-3 max-w-[280px]">
                <h3 className="text-[13px] font-black uppercase tracking-[0.3em] text-blue-400 stagger-1">
                  ESTABLISHING CONNECTION
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed font-medium stagger-2">
                  雲端伺服器正在從休眠狀態中甚醒。此過程通常需要
                  <span className="text-blue-400 font-black mx-1">60–90</span>秒。
                </p>
              </div>

              {/* Shimmer Progress Bar */}
              <div className="w-48 stagger-3">
                <div className="h-[3px] bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent animate-[shimmer-bar_2s_ease-in-out_infinite] rounded-full" />
                </div>
                <p className="text-center mt-3 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
                  AUTO-RETRY ACTIVE
                </p>
              </div>
            </div>
          )}

          {/* ====== FULL-SCREEN ERROR OVERLAY ====== */}
          {step === 1 && status === 'error' && (
            <div className="flex flex-col items-center justify-center py-10 gap-7 animate-in fade-in zoom-in-95 duration-500">
              {/* Error Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-red-500/15 to-orange-600/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.12)]">
                  <AlertTriangle size={28} className="text-red-500 animate-[float_3s_ease-in-out_infinite]" />
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center border-[3px] border-[#14161B] shadow-lg">
                  <X size={12} strokeWidth={3} />
                </div>
              </div>

              {/* Error Content */}
              <div className="text-center space-y-3 max-w-[300px]">
                <h3 className="text-[13px] font-black uppercase tracking-[0.3em] text-red-500 stagger-1">
                  CONNECTION FAILED
                </h3>
                <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl stagger-2">
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                    {resultMsg || "同步失敗，可能是雲端伺服器未回應或權限驗證失敗。"}
                  </p>
                </div>
              </div>

              {/* Recovery Actions */}
              <div className="flex flex-col gap-3 w-full max-w-[220px] stagger-3">
                <button
                  onClick={() => { setStatus('idle'); setResultMsg(''); handleManualPing(); }}
                  className="w-full py-3.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                >
                  <RefreshCw size={12} />
                  RETRY CONNECTION
                </button>
                <button
                  onClick={() => { setStatus('idle'); setResultMsg(''); }}
                  className="w-full py-2.5 text-[10px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest"
                >
                  DISMISS
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: CONFIG (only when NOT sleeping/error) */}
          {step === 1 && backendStatus !== 'sleeping' && status !== 'error' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-3 duration-300">
              {/* Date Selection */}
              <div className="space-y-3">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between w-full">
                  <div className="w-full flex justify-between items-center mb-1.5 px-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                      日期範圍
                    </label>
                    <div className="flex gap-1">
                      {[5, 10, 20, 30].map((days) => {
                        const today = new Date();
                        const past = new Date();
                        past.setDate(today.getDate() - days + 1);
                        const rangeStart = getLocalDateStr(past);
                        const rangeEnd = getLocalDateStr(today);
                        const isActive =
                          startDate === rangeStart && endDate === rangeEnd;

                        return (
                          <button
                            key={days}
                            onClick={() => {
                              setEndDate(rangeEnd);
                              setStartDate(rangeStart);
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all font-barlow-numeric border ${isActive
                              ? "bg-[#C8B085] text-black border-[#C8B085]"
                              : "bg-white/5 border-white/5 hover:bg-[#C8B085] hover:text-black hover:border-[#C8B085] text-slate-500"
                              }`}
                          >
                            {days}D
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowCalendar(true)}
                  className="w-full bg-[#1C1E22]/35 backdrop-blur-xl backdrop-saturate-150 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-2xl px-5 py-4 flex items-center justify-between group hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#C8B085]/10 flex items-center justify-center text-[#C8B085]">
                      <CalendarDays size={20} />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <div className="text-xs sm:text-sm font-bold text-white font-barlow-numeric tracking-wide">
                        {startDate}{" "}
                        <span className="text-slate-600 mx-2">➔</span> {endDate}
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors group-hover:scale-110 duration-300">
                    <ChevronRight
                      size={16}
                      className="text-slate-600 group-hover:text-white transition-colors"
                    />
                  </div>
                </button>
              </div>

              {/* Accounts Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#C8B085] rounded-full"></div>
                    選擇券商帳號
                  </label>
                  <button
                    onClick={handleManualPing}
                    disabled={backendStatus === "checking"}
                    className={`
                                            flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold transition-all
                            ${backendStatus === "online"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 cursor-default"
                        : backendStatus === "checking"
                          ? "bg-slate-500/10 border-slate-500/20 text-slate-400 cursor-wait"
                          : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer active:scale-95"
                      }
                                        `}
                  >
                    {backendStatus === "checking" && (
                      <RefreshCw size={8} className="animate-spin" />
                    )}
                    {backendStatus === "online" && <Wifi size={8} />}
                    {backendStatus === "offline" && <Power size={8} />}

                    <span>
                      {backendStatus === "online"
                        ? "已連線"
                        : backendStatus === "checking"
                          ? "連線中..."
                          : "喚醒後端"}
                    </span>
                  </button>
                </div>
                <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto pr-2 overflow-x-hidden custom-scrollbar">
                  {configs.flatMap((config) => {
                    const branches = (config.branch || 'Unknown').split(',');
                    const codes = (config.branchCode || '').split(',');

                    return branches.map((bRaw, subIdx) => {
                      const bText = bRaw.trim();
                      const bCode = codes[subIdx] || '';

                      const uniqueKey = `${config.id}|${bCode}|${subIdx}`;
                      const isSelected = selectedConfigIds.includes(uniqueKey);

                      // Color Logic (Same as Settings)
                      // Robust Identification (Stock default fallback)
                      const isFuture = bText.includes('期貨') || bText.includes('Futures');
                      const isSub = bText.includes('複委託') || bText.includes('Sub') || bText.includes('H-');

                      const theme = isFuture
                        ? ACCOUNT_CATEGORY_THEMES.FUTURES
                        : isSub
                          ? ACCOUNT_CATEGORY_THEMES.SUB
                          : ACCOUNT_CATEGORY_THEMES.STOCK;

                      const typeColorClass = theme.fullClass;
                      const typeLabel = theme.label;

                      return (
                        <div
                          key={uniqueKey}
                          onClick={() => !isSub && toggleConfigSelection(config.id, bCode, subIdx)}
                          className={`
                                    relative p-4 rounded-xl border transition-all backdrop-blur-xl backdrop-saturate-150 group select-none
                                    ${isSub
                              ? "opacity-40 cursor-not-allowed bg-black/40 border-white/5 grayscale"
                              : "cursor-pointer " + (isSelected
                                ? "bg-[#C8B085]/10 border-[#C8B085]/40 shadow-[0_0_20px_rgba(200,176,133,0.05),inset_0_1px_1px_rgba(255,255,255,0.1)]"
                                : "bg-[#1C1E22]/35 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.05] hover:border-white/20")
                            }
                                `}
                        >
                          <div className="flex items-center gap-4">
                            {/* 1. Left Checkbox (New Position) */}
                            <div
                              className={`shrink-0 w-5 h-5 rounded-[6px] border transition-all flex items-center justify-center ${isSub
                                ? "bg-transparent border-white/10"
                                : isSelected
                                  ? "bg-[#C8B085] border-[#C8B085] shadow-[0_0_8px_rgba(200,176,133,0.4)]"
                                  : "bg-transparent border-white/20 group-hover:border-white/40"
                                }`}
                            >
                              {isSelected && !isSub && <Check size={12} className="text-[#14161B] stroke-[4]" />}
                            </div>

                            {/* 2. Info Content */}
                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[12px] font-bold tracking-wide truncate ${isSelected ? 'text-white' : 'text-zinc-200'} ${isSub ? 'text-zinc-500' : ''}`}>
                                  {(() => {
                                    const brokerName = '永豐金';
                                    let middle = typeLabel === '期貨' ? '期貨' : bText.replace(/\(.*\)/, '');
                                    middle = middle.replace('永豐金-', '').replace('永豐金', '').trim();

                                    const name = config.alias || config.brokerUsername || 'User';
                                    const cleanName = name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                                    return `${brokerName}-${middle} | ${cleanName}`;
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`rounded-full font-bold border shadow-sm whitespace-nowrap flex items-center justify-center ${isSub
                                  ? 'px-1.5 py-0.5 text-[8px] min-w-[42px] border-zinc-700 text-zinc-600 bg-zinc-800/50'
                                  : `px-2 py-0.5 text-[9px] min-w-[48px] w-auto ${typeColorClass}`
                                  }`}>
                                  {isSub ? "尚未支援" : typeLabel}
                                </span>
                                <span className={`text-[10px] font-bold font-mono tracking-wide whitespace-nowrap ${isSub ? 'text-zinc-600' : 'text-zinc-500'}`}>
                                  {(() => {
                                    const accList = (config.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                    const codeList = (config.branchCode || '').split(',').map(s => s.trim()).filter(Boolean);
                                    const displayAcc = accList[subIdx] || (codeList[subIdx]?.length >= 7 ? codeList[subIdx] : '');
                                    return displayAcc;
                                  })()}
                                </span>
                              </div>
                            </div>

                            {/* 3. Desktop Dropdown (Right) */}
                            {isSelected && (
                              <div
                                className="hidden sm:block w-[130px] animate-in fade-in zoom-in-95 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GlassSelect
                                  value={accountPortfolioMap[uniqueKey] || targetPortfolioId}
                                  onChange={(val) => {
                                    setAccountPortfolioMap(prev => ({ ...prev, [uniqueKey]: val }));
                                  }}
                                  options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                                  variant="capsule"
                                  placeholder="匯入至..."
                                  align="right"
                                  className="text-[10px]"
                                />
                              </div>
                            )}
                          </div>

                          {/* 4. Mobile Dropdown (Row 2) */}
                          {isSelected && (
                            <div
                              className="sm:hidden mt-3 pt-3 border-t border-white/5 animate-in slide-in-from-top-1 duration-200"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GlassSelect
                                value={accountPortfolioMap[uniqueKey] || targetPortfolioId}
                                onChange={(val) => {
                                  setAccountPortfolioMap(prev => ({ ...prev, [uniqueKey]: val }));
                                }}
                                options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                                variant="capsule"
                                placeholder="匯入至..."
                                align="left"
                                className="text-[11px] w-full"
                              />
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>
              </div>

              {/* Error or Login Prompt */}
              {selectedConfigIds.length > 0 && resultMsg && (
                <div
                  className={`p-4 border rounded-2xl text-[11px] font-bold flex items-center gap-3 animate-in fade-in duration-300 bg-red-500/10 border-red-500/20 text-red-400`}
                >
                  <AlertTriangle size={16} />
                  {resultMsg}
                </div>
              )}

              {/* Auto Merge Option */}
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id="sync-auto-merge"
                  checked={autoMerge}
                  onChange={(e) => setAutoMerge(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[#C8B085] focus:ring-[#C8B085] focus:ring-offset-0 cursor-pointer"
                />
                <label
                  htmlFor="sync-auto-merge"
                  className="text-[10px] text-slate-400 cursor-pointer select-none"
                >
                  {lang === "zh"
                    ? "合併同單號分筆交易"
                    : "Merge Split Fills (Group by Order No)"}
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW */}
          {step === 2 && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              {/* Target Portfolio Selector */}
              {/* Target Portfolio Selector */}
              {/* Target Portfolio Selector */}
              <div className="flex flex-col gap-2">
                {/* 💊 Account Mapping Capsule (Collapsible) */}
                <button
                  onClick={() => setShowMapping(!showMapping)}
                  className={`
                    w-full py-2.5 px-4 rounded-full border transition-all duration-300 flex items-center justify-between group
                    ${showMapping
                      ? "bg-[#C8B085]/10 border-[#C8B085]/30 shadow-[0_4px_20px_rgba(200,176,133,0.05)]"
                      : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10 shadow-sm"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-7 h-7 rounded-full flex items-center justify-center transition-colors
                      ${showMapping ? "bg-[#C8B085] text-black" : "bg-white/5 text-slate-500"}
                    `}>
                      <ShieldCheck size={14} />
                    </div>
                    <div className="flex flex-col items-start gap-0.5">
                      <span className={`text-[9px] font-bold uppercase tracking-widest ${showMapping ? "text-[#C8B085]" : "text-slate-500"}`}>
                        匯入帳戶對應 (Account Mapping)
                      </span>
                      <span className="text-[10px] font-medium text-slate-400/60">
                        {selectedConfigIds.length} 個帳號已連接 • {portfolios.find(p => p.id === targetPortfolioId)?.name || '預設錢包'}
                      </span>
                    </div>
                  </div>
                  <div className={`p-1 rounded-full transition-transform duration-300 ${showMapping ? "rotate-180 bg-[#C8B085]/20 text-[#C8B085]" : "text-slate-600 group-hover:text-slate-400"}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>

                {/* Expanded Mapping Content */}
                {showMapping && (
                  <div className="bg-black/20 p-4 rounded-[24px] border border-white/5 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col gap-2 w-full pr-1">
                      {selectedConfigIds.map(key => {
                        const [confId, code, subIdxStr] = key.split('|');
                        const subIdx = parseInt(subIdxStr || '0', 10);
                        const conf = configs.find(c => c.id === confId);
                        const branches = (conf?.branch || '').split(',');
                        const branchName = branches[subIdx] || conf?.branch || 'Unknown';

                        const bText = branchName;
                        const isFuture = bText.includes('期貨') || bText.includes('Futures');
                        const isSub = bText.includes('複委託') || bText.includes('Sub') || bText.includes('H-');

                        const theme = isFuture
                          ? ACCOUNT_CATEGORY_THEMES.FUTURES
                          : isSub
                            ? ACCOUNT_CATEGORY_THEMES.SUB
                            : ACCOUNT_CATEGORY_THEMES.STOCK;

                        const typeColorClass = theme.fullClass;
                        const typeLabel = theme.label;

                        const name = conf?.alias || conf?.brokerUsername || 'User';
                        const displayName = name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                        const middle = typeLabel === '期貨' ? '期貨' : branchName.replace(/\(.*\)/, '').replace('分公司', '');

                        const currentTargetId = accountPortfolioMap[key] || targetPortfolioId;

                        return (
                          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/5 pb-3 sm:pb-2 last:border-0 last:pb-0">
                            <div className="flex-1 flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white tracking-tight">
                                  永豐金-{middle} | {displayName}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 pl-0.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeColorClass} shadow-sm whitespace-nowrap w-[52px] flex items-center justify-center`}>
                                  {typeLabel}
                                </span>
                                <span className="text-[12px] font-bold text-zinc-500 font-mono tracking-wide">
                                  {(() => {
                                    const accList = (conf?.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                    const codeList = (conf?.branchCode || '').split(',').map(s => s.trim()).filter(Boolean);
                                    const idx = branches.indexOf(branchName);
                                    const displayAcc = accList[idx] || (codeList[idx]?.length >= 7 ? codeList[idx] : '');
                                    return displayAcc;
                                  })()}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto shrink-0">
                              <ArrowRight className="text-zinc-600 w-4 h-4 rotate-90 sm:rotate-0" />
                              <div className="w-full sm:w-[150px]">
                                <GlassSelect
                                  value={currentTargetId}
                                  onChange={(val) => {
                                    setAccountPortfolioMap(prev => ({ ...prev, [key]: val }));
                                    setTransactions(prev => prev.map(t => {
                                      // @ts-ignore
                                      if (t.sourceKey === key) return { ...t, portfolioId: val };
                                      return t;
                                    }));
                                  }}
                                  options={portfolios.map(p => ({ value: p.id, label: p.name }))}
                                  variant="capsule"
                                  placeholder="選擇錢包"
                                  className="text-[10px]"
                                  align="right"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-[350px] overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                {status === "error" ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-6 px-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-[30px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
                        <AlertTriangle size={32} className="animate-[float_3s_ease-in-out_infinite]" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center border-4 border-[#14161B] shadow-lg">
                        <Zap size={14} fill="currentColor" />
                      </div>
                    </div>

                    <div className="text-center space-y-2">
                      <h4 className="text-sm font-black uppercase tracking-[0.3em] text-red-500">System Diagnosis</h4>
                      <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl max-w-sm">
                        <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">
                          {resultMsg || "同步失敗，可能是雲端伺服器連線不穩或權限驗證失敗。"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-[240px]">
                      <button
                        onClick={() => { setStatus('idle'); handleManualPing(); }}
                        className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
                      >
                        RETRY CONNECTION
                      </button>
                    </div>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-4 text-slate-500/40">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${resultMsg && resultMsg.includes('失敗') ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/[0.02] border border-white/[0.05]'}`}>
                      {resultMsg && resultMsg.includes('失敗') ? (
                        <AlertTriangle size={24} className="text-red-500/60" />
                      ) : (
                        <CalendarDays size={24} className="opacity-20" />
                      )}
                    </div>
                    <div className="text-center space-y-2 max-w-sm px-4">
                      <p className="text-[11px] font-black tracking-widest uppercase">
                        {resultMsg && resultMsg.includes('失敗') ? 'Sync Failed' : 'No Data Found'}
                      </p>
                      {resultMsg ? (
                        <div className={`p-3 rounded-xl border text-left ${resultMsg.includes('失敗') ? 'bg-red-500/5 border-red-500/15' : 'bg-white/[0.02] border-white/5'}`}>
                          <p className={`text-[10px] font-medium leading-relaxed ${resultMsg.includes('失敗') ? 'text-red-400/80' : 'text-zinc-500'}`}>
                            {resultMsg}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] font-medium mt-1">
                          此區間無同步交易紀錄
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="space-y-1">
                      <div
                        className={`px-2.5 py-2 rounded-2xl border transition-all duration-300 flex items-start gap-2.5 relative group/item overflow-hidden ${tx.isDuplicate && tx.selected
                            ? "bg-amber-950/30 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.08)]"
                            : tx.isDuplicate
                              ? "bg-black/30 border-white/[0.04] opacity-50 hover:opacity-80"
                              : !tx.selected
                                ? "bg-black/20 border-white/5 opacity-40 grayscale-[100%] hover:opacity-100 hover:grayscale-0"
                                : "bg-[#1C1E22]/50 border-white/10 shadow-lg shadow-black/25"
                          }`}
                      >
                        {/* Left-stripe: amber when duplicate+selected, zinc when duplicate+unchecked */}
                        {tx.isDuplicate && (
                          <div className={`absolute left-0 top-2 bottom-2 w-[2px] rounded-full transition-colors duration-300 ${tx.selected ? "bg-amber-500/70" : "bg-zinc-600/60"
                            }`} />
                        )}

                        {/* Left: Checkbox (Top aligned) */}
                        <input
                          type="checkbox"
                          checked={tx.selected}
                          onChange={() => toggleSelection(tx.id)}
                          className={`mt-1 w-4 h-4 rounded-md bg-black/40 focus:ring-0 cursor-pointer shrink-0 transition-all ${tx.isDuplicate && tx.selected
                              ? "text-amber-500 border-amber-500/50"
                              : "text-[#C8B085] border-[#C8B085]/30 border-white/20"
                            }`}
                        />

                        {/* Right: Content Column (2 rows) */}
                        <div className="flex flex-col gap-2 w-full min-w-0">
                          {/* Row 1: Info (Date Left, PnL Right) */}
                          <div className="flex items-center justify-between">
                            {/* Date + Badge */}
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-zinc-500 font-bold tracking-tight shrink-0 leading-none">
                                {formatDateWithWeekday(tx.date)
                                  .split("(")[0]
                                  .trim()}
                              </span>
                              {tx.isDuplicate && (
                                <div className="group/tooltip relative flex items-center gap-1 cursor-help">
                                  {tx.selected ? (
                                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-[0.08em] bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-px flex items-center gap-1">
                                      <AlertTriangle size={7} />
                                      將重複匯入
                                    </span>
                                  ) : (
                                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.12em] border border-zinc-700/60 rounded px-1 py-px">已存在</span>
                                  )}

                                  {/* Tooltip */}
                                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block z-50">
                                    <div className={`text-[9px] px-3 py-2 rounded-xl shadow-xl backdrop-blur-xl whitespace-nowrap ${tx.selected
                                        ? "bg-amber-950 border border-amber-500/30 text-amber-200"
                                        : "bg-zinc-950 border border-zinc-800 text-zinc-400"
                                      }`}>
                                      <span className={`font-bold block mb-1 ${tx.selected ? "text-amber-300" : "text-zinc-300"}`}>
                                        {tx.selected ? "⚠ 此交易將被重複匯入" : "已在記錄中"}
                                      </span>
                                      {tx.duplicateReason || "此交易已在記錄中存在"}
                                      <div className={`absolute left-2 top-full w-2 h-2 transform rotate-45 -mt-1 ${tx.selected
                                          ? "bg-amber-950 border-r border-b border-amber-500/30"
                                          : "bg-zinc-950 border-r border-b border-zinc-800"
                                        }`} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Stock & PnL Pill (Moved to Right) */}
                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg border border-white/10 shrink-0">
                              <span className="text-[10px] font-black text-white truncate max-w-[80px] tracking-tight">
                                {(() => {
                                  try {
                                    const formattedCode = formatSymbolCode(tx.code);
                                    const parts = formattedCode.split(" ");
                                    return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
                                  } catch (error) {
                                    console.error('[SyncDateModal] formatSymbolCode error:', error);
                                    return tx.code || 'Unknown';
                                  }
                                })()}
                              </span>
                              <div className="w-[1px] h-2.5 bg-white/10 shrink-0" />
                              <span
                                className={`text-[10px] font-black font-barlow-numeric tracking-tight ${tx.pnl >= 0 ? "text-[#D05A5A]" : "text-[#5B9A8B]"}`}
                              >
                                {(tx.pnl >= 0 ? "+" : "") + formatMoney(tx.pnl)}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Actions (Full Width) */}
                          <div className="flex items-center gap-2 w-full">
                            {/* Strategy */}
                            <div className="flex-1 min-w-[70px]">
                              <GlassSelect
                                value={tx.strategy}
                                onChange={(val) =>
                                  updateTxField(tx.id, "strategy", val)
                                }
                                options={[
                                  { value: "", label: "策略" },
                                  ...availableStrategies.map((s: string) => ({
                                    value: s,
                                    label: s,
                                  })),
                                ]}
                                placeholder="策略"
                                variant="capsule"
                                align="left"
                                className="w-full text-[10px]"
                              />
                            </div>

                            {/* Tag */}
                            <div className="flex-1 min-w-[60px]">
                              <GlassSelect
                                value={tx.tag}
                                onChange={(val) =>
                                  updateTxField(tx.id, "tag", val)
                                }
                                options={[
                                  { value: "", label: "標籤" },
                                  ...availableEmotions.map((e: string) => ({
                                    value: e,
                                    label: e,
                                  })),
                                ]}
                                placeholder="標籤"
                                variant="capsule"
                                align="left"
                                className="w-full text-[10px]"
                              />
                            </div>

                            {/* Account */}
                            <div className="flex-1 min-w-[60px]">
                              <GlassSelect
                                value={tx.portfolioId || targetPortfolioId}
                                onChange={(val) =>
                                  updateTxField(tx.id, "portfolioId", val)
                                }
                                options={portfolios.map((p) => ({
                                  value: p.id,
                                  label: p.name,
                                }))}
                                placeholder="帳號"
                                variant="capsule"
                                className="w-full text-[10px]"
                              />
                            </div>

                            {/* Note Button */}
                            <button
                              onClick={() =>
                                updateTxField(
                                  tx.id,
                                  "showNoteInput",
                                  !tx.showNoteInput,
                                )
                              }
                              className={`h-6 w-6 flex items-center justify-center rounded transition-all shrink-0 ${tx.showNoteInput ? "bg-[#C8B085] text-black" : "bg-white/5 text-slate-500 hover:text-slate-300 active:scale-95"}`}
                            >
                              <MessageSquare size={12} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {tx.showNoteInput && (
                        <div className="px-5 pb-2 animate-in slide-in-from-top-2 duration-200">
                          <input
                            type="text"
                            value={tx.note}
                            onChange={(e) =>
                              updateTxField(tx.id, "note", e.target.value)
                            }
                            placeholder="輸入自定義備註..."
                            className="w-full bg-white/5 border border-[#C8B085]/30 rounded-xl px-4 py-2 text-[10px] text-slate-300 outline-none focus:border-[#C8B085] transition-all"
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Summary */}
              <div className="pt-5 border-t border-white/5 flex justify-between items-center px-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  匯入筆數:{" "}
                  <span className="text-white font-black ml-1">
                    {transactions.filter((t) => t.selected).length}
                  </span>
                </div>
                <div className="text-lg font-black font-barlow-numeric text-white flex gap-3 items-baseline">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    TOTAL
                  </span>
                  <span
                    className={`${transactions.filter((t) => t.selected).reduce((sum, t) => sum + t.pnl, 0) >= 0 ? "text-[#D05A5A]" : "text-[#5B9A8B]"}`}
                  >
                    $
                    {formatMoney(
                      transactions
                        .filter((t) => t.selected)
                        .reduce((sum, t) => sum + t.pnl, 0),
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex justify-between items-center bg-black/30">
          <div className="flex items-center gap-2">
            {step === 1 && (
              <>
                {backendStatus === "checking" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                    CHECKING...
                  </div>
                )}
                {backendStatus === "sleeping" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-mono animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]" />
                    WAKING UP...
                  </div>
                )}
                {backendStatus === "online" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-mono">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    ONLINE
                  </div>
                )}
                {backendStatus === "offline" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-mono">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    OFFLINE
                  </div>
                )}
                <button
                  onClick={handleManualPing}
                  disabled={backendStatus === "checking"}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    size={10}
                    className={
                      backendStatus === "checking" ? "animate-spin" : ""
                    }
                  />
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {backendStatus === 'sleeping' && (
              <div className="bg-white/[0.03] border border-white/10 rounded-[28px] p-5 flex flex-col gap-4 backdrop-blur-3xl shadow-[0_20px_50px_rgba(80,200,255,0.08)] mb-2 group overflow-hidden relative">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl pointer-events-none rounded-full" />

                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-[#50C8FF]/10 flex items-center justify-center text-[#50C8FF] shadow-inner">
                    <div className="orbital-loader">
                      <Zap size={18} className="animate-pulse" />
                      <div className="orbital-dot" style={{ animationDelay: '0s' }} />
                      <div className="orbital-dot" style={{ animationDelay: '-0.5s' }} />
                      <div className="orbital-dot" style={{ animationDelay: '-1s' }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-400 stagger-1">
                      Nebula Wake-up
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold stagger-2">
                      伺服器正在從星雲中甦醒...
                    </span>
                  </div>
                </div>

                <div className="space-y-2 relative z-10 pl-14">
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-medium stagger-3">
                    Render 免費版主機進入休眠狀態。正在為您建立專屬連線，這通常需要 <span className="text-blue-400 font-black">60-90</span> 秒。
                  </p>
                  <div className="flex items-center gap-2 stagger-3">
                    <Activity size={10} className="text-blue-500/50" />
                    <div className="h-[2px] w-24 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/40 animate-[shimmer_2s_infinite]" style={{ width: '40%' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 rounded-2xl text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  BACK
                </button>
              )}

              <button
                onClick={step === 1 ? () => handleFetch() : handleConfirmImport}
                disabled={status === "loading" || backendStatus === "sleeping" || (step === 1 && selectedConfigIds.length === 0)}
                className={`relative overflow-hidden px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95 
                  ${status === "loading"
                    ? "bg-[#14161B] border border-[#C8B085]/30 text-[#C8B085] w-full disabled:opacity-100 disabled:cursor-wait shadow-[0_0_30px_rgba(200,176,133,0.1)]"
                    : backendStatus === "sleeping"
                      ? "bg-zinc-800 text-zinc-400 w-full disabled:opacity-100 disabled:cursor-wait"
                      : "bg-[#C8B085] hover:bg-[#B09870] text-black shadow-[0_4px_20px_rgba(200,176,133,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
              >
                {status === "loading" && (
                  <>
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-transparent via-[#C8B085]/20 to-[#C8B085]/40 transition-all duration-500 ease-out flex items-center justify-end"
                      style={{ width: `${loadingProgress}%` }}
                    >
                      {/* Glowing Leading Edge */}
                      <div className="h-full w-[2px] bg-[#C8B085] shadow-[0_0_15px_2px_#C8B085]" />
                    </div>
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer-bar_1.5s_infinite]" style={{ width: '200%' }} />
                  </>
                )}

                <span className="relative z-10 flex items-center gap-3">
                  {status === "loading" ? (
                    <>
                      <div className="relative w-4 h-4 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-[#C8B085]/30 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#C8B085] animate-pulse shadow-[0_0_8px_#C8B085]" />
                      </div>
                      <span className="tracking-[0.2em]">{loadingMessage || "PROCESSING..."}</span>
                      <span className="font-barlow-numeric text-[11px] text-white bg-black/40 px-2 py-0.5 rounded border border-[#C8B085]/30 shadow-inner">
                        {loadingProgress}%
                      </span>
                    </>
                  ) : backendStatus === "sleeping" ? (
                    <>
                      <div className="orbital-loader mr-1 scale-75 text-zinc-400">
                        <div className="orbital-dot" />
                        <div className="orbital-dot" style={{ animationDelay: '-1s' }} />
                      </div>
                      <span className="animate-pulse tracking-[0.2em]">BOOTING...</span>
                    </>
                  ) : (
                    <>
                      {step === 1
                        ? lang === "zh"
                          ? "登入並同步"
                          : "LOGIN & SYNC"
                        : lang === "zh"
                          ? "確認匯入"
                          : "CONFIRM IMPORT"}
                      <CheckCircle2 size={14} />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Setup Helper Dialog */}
      {showApiHelper &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowApiHelper(false)}
          >
            <div
              className="bg-[#1A1C21]/95 rounded-3xl border border-white/10 p-6 max-w-md mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <ShieldCheck size={20} />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white mb-1">
                    永豐金 API 設定
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    使用 Python API 需要先在永豐金網站簽署同意書並取得 API Key
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] font-bold text-slate-300 mb-2">
                    請問您是否已開通 Python API？
                  </p>
                </div>

                {/* Option 1: Not yet signed */}
                <button
                  onClick={() => {
                    window.open(
                      "https://www.sinotrade.com.tw/newweb/signCenter/S_openAPI/",
                      "_blank",
                    );
                    setShowApiHelper(false);
                  }}
                  className="w-full p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-xs font-bold text-amber-300 mb-0.5">
                        尚未開通
                      </p>
                      <p className="text-[9px] text-slate-400">
                        前往簽署 API 使用同意書
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-amber-400 group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </button>

                {/* Option 2: Already signed */}
                <button
                  onClick={() => {
                    window.open(
                      "https://www.sinotrade.com.tw/newweb/PythonAPIKey/",
                      "_blank",
                    );
                    setShowApiHelper(false);
                  }}
                  className="w-full p-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-xs font-bold text-emerald-300 mb-0.5">
                        已開通
                      </p>
                      <p className="text-[9px] text-slate-400">
                        前往管理我的 API Key
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-emerald-400 group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowApiHelper(false)}
                className="w-full py-2 text-[10px] font-bold text-slate-500 hover:text-white transition-colors"
              >
                取消
              </button>
            </div>
          </div>,
          document.body,
        )}

      {/* Date Range Modal */}
      <CustomDateRangeModal
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        onApply={(start, end) => {
          if (start) setStartDate(start);
          if (end) setEndDate(end);
          setShowCalendar(false);
        }}
        initialRange={{ start: startDate, end: endDate }}
        lang={lang}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
};
