import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  RefreshCw,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  MessageSquare,
  Check,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  Wifi,
  Power,
  ArrowRight,
} from "lucide-react";
import { Trade, BrokerConfig, Portfolio } from "../../types";
import {
  fetchBrokerPnl,
  fetchBrokerProfile,
  pingBackend,
} from "../../services/brokerService";
import { getLocalDateStr, formatDateWithWeekday } from "../../utils/format";
import { formatSymbolCode } from "../../utils/symbolNames";
import { CustomDateRangeModal } from "./CustomDateRangeModal";
import { useClickOutside } from "../../hooks/useClickOutside";
// No imports needed from SettingsView here
import { GlassSelect } from "../common/GlassSelect";
import { ACCOUNT_CATEGORY_THEMES } from '../../constants';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useTradeContext } from "../../context/TradeContext";
import { getCache, setCache } from "../../utils/cache";

// --- Interfaces ---
interface SyncDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (trades: Trade[]) => void;
  lang?: "zh" | "en";
  existingTrades?: Trade[];
}

// --- Internal Component: GlassSelect Moved to common/GlassSelect.tsx ---

export const SyncDateModal: React.FC<SyncDateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = "zh",
  existingTrades = [],
}) => {
  // --- Context ---
  const { availableStrategies, availableEmotions, portfolios } = useTradeContext();

  // --- State ---
  const [step, setStep] = useState<1 | 2>(1);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
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
  }, [isOpen, portfolios]); // Added portfolios dependency

  // --- Handlers ---
  
  // ... (Manual Ping) ...

  const handleManualPing = async () => {
    setBackendStatus("checking");
    const isOnline = await pingBackend();
    setBackendStatus(isOnline ? "online" : "offline");
  };

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
        if (cachedConfigs.length > 0) {
           // Fix Key Format: use pipe separator to match toggle logic
           const firstC = cachedConfigs[0];
           const codes = (firstC.branchCode || '').split(',');
           const firstCode = codes[0] || '';
           setSelectedConfigIds([`${firstC.id}|${firstCode}|0`]);
        }
      } else {
        // 3. 沒有快取,從 localStorage 載入完整設定
        const savedConfigs = localStorage.getItem("broker_configs");
        if (savedConfigs) {
          const parsed = JSON.parse(savedConfigs);
          initialConfigs = parsed;
          setConfigs(parsed);
          if (parsed.length > 0) {
             // Fix Key Format
             const firstC = parsed[0];
             const codes = (firstC.branchCode || '').split(',');
             const firstCode = codes[0] || '';
             setSelectedConfigIds([`${firstC.id}|${firstCode}|0`]);
          }
          // 存入快取供下次使用
          setCache("broker_configs_cache", parsed, 5 * 60 * 1000);
        }
      }

      // 4. REMOVED: Portfolios are now managed by Context. 
      //    We rely on 'portfolios' from useTradeContext() which is reactive.

      // 5. 背景檢測後端狀態 (不阻塞 UI)
      handleManualPing();
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

  // 🎨 階段式載入動畫
  const startLoadingAnimation = () => {
    setLoadingProgress(0);
    setLoadingMessage("正在連接券商 API...");

    // 階段式訊息切換
    const messages = [
      { time: 0, text: "正在連接券商 API...", progress: 10 },
      { time: 2000, text: "正在驗證身份...", progress: 30 },
      { time: 4000, text: "正在擷取交易紀錄...", progress: 50 },
      { time: 6000, text: "資料處理中...", progress: 70 },
      { time: 8000, text: "即將完成...", progress: 85 },
    ];

    messages.forEach(({ time, text, progress }) => {
      setTimeout(() => {
        setLoadingMessage(text);
        setLoadingProgress(progress);
      }, time);
    });
  };

  const stopLoadingAnimation = () => {
    setLoadingProgress(100);
    setLoadingMessage("");
  };

  const handleFetch = async () => {
    const totalStartTime = performance.now();
    console.log("🚀 [PERF] ===== 開始擷取券商資料 =====");
    console.log("🕐 [PERF] 開始時間:", new Date().toISOString());
    console.log(`📅 [DEBUG] 前端請求參數: Start=${startDate}, End=${endDate}`);
    
    // Validate Date (Prevent frontend state issues)
    if (!startDate || !endDate) {
        setResultMsg("日期範圍錯誤，請重新選擇");
        return;
    }

    if (selectedConfigIds.length === 0) {
      setResultMsg("請至少選擇一個券商帳號");
      return;
    }

    setStatus("loading");
    setResultMsg("");

    // 🎨 啟動階段式載入提示
    startLoadingAnimation();

    try {
      const step1Start = performance.now();
      if (selectedConfigIds.length === 0) throw new Error("請選擇帳號");
      console.log(
        `✅ [PERF] 步驟1 - 帳號設定確認: ${(performance.now() - step1Start).toFixed(0)}ms`,
      );

      // 呼叫後端 (支援多帳號合併、篩選)
      console.log("📞 [PERF] 步驟2 - 準備呼叫後端 API...");
      const step2Start = performance.now();
      const startD = new Date(startDate);
      const endD = new Date(endDate);

      // Group selections by (Config ID + Target Portfolio ID + Account Type)
      // Key: `configId|targetPortfolioId|type`
      // CRITICAL: Must separate Futures and Stock accounts even from same broker config
      const fetchGroups = new Map<string, { config: BrokerConfig, codes: Set<string>, targetPid: string, configId: string, type: 'S' | 'F' }>();
      
      console.log('🔍 [DEBUG] Selected Config IDs:', selectedConfigIds);
      console.log('🔍 [DEBUG] Account Portfolio Map:', accountPortfolioMap);
      console.log('🔍 [DEBUG] Default Target Portfolio:', targetPortfolioId);

      selectedConfigIds.forEach(key => {
          const [confId, code, subIdxStr] = key.split('|');
          const subIdx = parseInt(subIdxStr || '0', 10);
          const original = configs.find(c => c.id === confId);
          
          if (!original) return;
          
          // 🔍 CRITICAL FIX: Determine account type FIRST based on the specific branch
          const allBranches = (original.branch || '').split(',');
          const specificBranchName = allBranches[subIdx] || '';
          const type: 'S' | 'F' = (specificBranchName.includes('期貨') || specificBranchName.includes('Futures') || specificBranchName.includes('Option')) ? 'F' : 'S';
          
          console.log(`🔍 [DEBUG] Account ${key} -> Branch: "${specificBranchName}" -> Type: ${type}`);
          
          // Determine target portfolio: mapped specific > global target
          let targetPid = accountPortfolioMap[key];

          // 🧠 Smart Auto-Detection:
          // If no explicit mapping exists, try to guess based on branch name
          if (!targetPid) {
               if (type === 'F') {
                   // Try to find a portfolio named "期貨" or "Futures"
                   const futuresPortfolio = portfolios.find(p => p.name.includes('期貨') || p.name.includes('Futures'));
                   if (futuresPortfolio) {
                       console.log(`🤖 [SMART] Auto-detected Futures account: ${specificBranchName} -> ${futuresPortfolio.name}`);
                       targetPid = futuresPortfolio.id;
                       // IMPORTANT: Persist this auto-detection to state so UI dropdown matches
                       setAccountPortfolioMap(prev => ({ ...prev, [key]: futuresPortfolio.id }));
                   }
               }
          }
          
          // Fallback to default if still null
          if (!targetPid) targetPid = targetPortfolioId;

          // Group by config + targetPid + type (CRITICAL: type must be part of key)
          const groupKey = `${confId}|${targetPid}|${type}`;
          if (!fetchGroups.has(groupKey)) {
              fetchGroups.set(groupKey, { 
                  config: original, 
                  codes: new Set(), 
                  targetPid: targetPid,
                  configId: original.id,
                  type: type  // Store the determined type
              });
          }
          if (code && code !== 'undefined') {
              fetchGroups.get(groupKey)!.codes.add(code);
          }
      });

      let mergedDetails: any[] = [];
      
      // Iterate and fetch for each group
      for (const [key, group] of fetchGroups) {
            const { config, codes, targetPid, configId, type } = group;
            const filterCodeStr = Array.from(codes).join(',');
            
            console.log(`🌐 [DEBUG] Fetching for Config: ${config.id}, TargetPID: ${targetPid}, FilterCodes: ${filterCodeStr}, Type: ${type}`);

            const requestConfig = { ...config, branchCode: filterCodeStr, accountType: type };
            
            // Fetch
            const result = await fetchBrokerPnl(startD, endD, requestConfig);
            
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
      }

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
      const step3Start = performance.now();
      let processedTrades = result.details.map((d, i) => {
        // Base transformation
        const isFuture = d.category === '期貨';
        const unit = isFuture ? '口' : '張';
        const qtyValue = isFuture ? d.quantity : (d.quantity / 1000);
        const sheets = qtyValue.toFixed(isFuture ? 0 : 0); // Both usually 0 decimals but keeping logic separate
        
          
          // Calculate dynamic yield if not provided but buyAmt exists
          let yieldPct = d.yield || 0;
          if (!yieldPct && d.buyAmt > 0) {
              yieldPct = Number((d.pnl / d.buyAmt * 100).toFixed(2));
          }
        
        const yieldStr = yieldPct !== 0
          ? `${yieldPct > 0 ? "+" : ""}${yieldPct}%`
          : "0%";

        // 🔧 CRITICAL FIX: Generate STABLE ID based on transaction properties
        // Instead of using Date.now() which changes every time
        // Use combination of: orderNo (if available) + date + code + pnl
        const stockCode = d.code.split(' ')[0]; // Extract pure stock/futures code
        const orderNo = d.orderNo || '';
        
        let stableId: string;
        if (orderNo && !orderNo.startsWith('unknown')) {
          // Best case: Use orderNo as primary identifier
          stableId = `${orderNo}-${d.date}-${stockCode}`;
        } else {
          // Fallback: Use content-based hash (date + code + pnl + quantity)
          // This ensures same transaction always gets same ID
          const contentKey = `${d.date}_${stockCode}_${d.pnl.toFixed(2)}_${d.quantity}_${d.price}`;
          stableId = `tx-${contentKey}`;
        }

        return {
          id: stableId, // ✅ Now using stable ID
          date: d.date,
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
          note: `${d.code} | ${yieldStr} | ${sheets}${unit}`.trim(),
          showNoteInput: false,
          raw_yield: yieldPct,
          category: d.category,
          configId: (d as any).configId, // Preserve source config ID
          sourceKey: (d as any).sourceKey // Preserve source key for precise mapping
        };
      });

      // 1. 合併分筆交易整合 (Aggregation)
      // 只有當 autoMerge=true 時，才合併「同 orderNo + 同標的」的交易
      if (autoMerge) {
        const groupedMap = new Map<string, (typeof processedTrades)[0]>();

        processedTrades.forEach((trade) => {
          // 產生複合 key: orderNo + 標的代號，確保只有同標的才會合併
          const stockCode = trade.code.split(" ")[0];
          const orderNo = trade.orderNo;

          // 無有效 orderNo，不合併
          if (!orderNo || orderNo.startsWith("unknown")) {
            groupedMap.set(trade.id, trade);
            return;
          }

          // 複合 key = orderNo + stockCode
          const compositeKey = `${orderNo}_${stockCode}`;

          if (groupedMap.has(compositeKey)) {
            // 執行合併
            const existing = groupedMap.get(compositeKey)!;
            const totalQty = existing.quantity + trade.quantity;
            // 計算平均價格 (加權平均)
            const avgPrice =
              totalQty !== 0
                ? (existing.price * existing.quantity +
                    trade.price * trade.quantity) /
                  totalQty
                : existing.price;

            existing.quantity = totalQty;
            existing.price = avgPrice;
            existing.pnl += trade.pnl;

            // 更新備註中的張數/口數
            const isFuture = existing.category === '期貨';
            const unit = isFuture ? '口' : '張';
            const mergedQtyValue = isFuture ? Math.abs(totalQty) : Math.abs(totalQty / 1000);
            const mergedSheets = mergedQtyValue.toFixed(0);
            
            const noteParts = existing.note.split("|");
            if (noteParts.length >= 2) {
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
      // 判斷標準：同日期 + 同標的 (精確比對) + 同損益 (±1 容差)
      // 注意：這只是「標記」為重複並預設不勾選，不會刪除交易
      processedTrades = processedTrades.map((trade) => {
        let isDup = false;
        let dupReason = "";

        if (existingTrades && existingTrades.length > 0) {
          const tradeStockCode = trade.code.split(" ")[0]; // 取得純股票代號如 "2890"

          const match = existingTrades.find((e) => {
            const sameDate = e.date === trade.date;

            // 標的比對：更精確的匹配 - 使用正規表達式確保完整代號匹配
            // 例如 "2890" 應該匹配 "2890 永豐金" 但不應該匹配 "28901"
            const codeRegex = new RegExp(`\\b${tradeStockCode}\\b`);
            const sameCode = e.note && codeRegex.test(e.note);

            // 損益比對 (允許浮點數微小誤差)
            const samePnl = Math.abs(e.pnl - trade.pnl) < 1;

            return sameDate && sameCode && samePnl;
          });

          if (match) {
            isDup = true;
            dupReason = "日期、標的與損益重複";
          }
        }

        return {
          ...trade,
          isDuplicate: isDup,
          duplicateReason: dupReason,
          selected: !isDup, // 若重複預設不勾選，但仍顯示供使用者決定
        };
      });
      console.log(
        `✅ [PERF] 步驟3 - 資料處理完成: ${(performance.now() - step3Start).toFixed(0)}ms`,
      );

      setTransactions(processedTrades);
      setStatus("idle");

      // 🎨 停止載入動畫
      stopLoadingAnimation();

      if (processedTrades.length === 0) {
        setResultMsg("此區間無交易紀錄");
      } else {
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

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0B0F]/85 backdrop-blur-2xl animate-in fade-in duration-300 p-4 overflow-hidden">
      {/* Ambient Background Flares (Design Premium Touch) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#C8B085]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D05A5A]/5 rounded-full blur-[100px] pointer-events-none" />

      <div
        className={`relative w-full ${step === 2 ? "max-w-4xl" : "max-w-md"} bg-[#14161B]/90 rounded-[40px] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-3xl transition-all duration-500 flex flex-col my-auto overflow-hidden animate-in zoom-in-95`}
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

        <div className="p-7">
          {/* STEP 1: CONFIG */}
          {step === 1 && (
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
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all font-barlow-numeric border ${
                              isActive
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
                                            ${
                                              backendStatus === "online"
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
                          onClick={() => toggleConfigSelection(config.id, bCode, subIdx)}
                          className={`
                                    relative p-4 rounded-xl border transition-all cursor-pointer backdrop-blur-xl backdrop-saturate-150 group select-none
                                    ${
                                      isSelected
                                        ? "bg-[#C8B085]/10 border-[#C8B085]/40 shadow-[0_0_20px_rgba(200,176,133,0.05),inset_0_1px_1px_rgba(255,255,255,0.1)]"
                                        : "bg-[#1C1E22]/35 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] hover:bg-white/[0.05] hover:border-white/20"
                                    }
                                `}
                        >
                           <div className="flex items-center gap-4">
                               {/* 1. Left Checkbox (New Position) */}
                               <div 
                                   className={`shrink-0 w-5 h-5 rounded-[6px] border transition-all flex items-center justify-center ${
                                       isSelected 
                                       ? "bg-[#C8B085] border-[#C8B085] shadow-[0_0_8px_rgba(200,176,133,0.4)]" 
                                       : "bg-transparent border-white/20 group-hover:border-white/40"
                                   }`}
                               >
                                   {isSelected && <Check size={12} className="text-[#14161B] stroke-[4]" />}
                               </div>

                               {/* 2. Info Content */}
                               <div className="flex-1 flex flex-col gap-1 min-w-0">
                                   <div className="flex items-center gap-2">
                                        <span className={`text-[12px] font-bold tracking-wide truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                                           {(() => {
                                               const brokerName = '永豐金';
                                               // 🔧 CRITICAL FIX: Strip redundant broker name from branch text to prevent "永豐金-永豐金-板新"
                                               let middle = typeLabel === '期貨' ? '期貨' : bText.replace(/\(.*\)/, '');
                                               middle = middle.replace('永豐金-', '').replace('永豐金', '').trim();
                                               
                                               const name = config.alias || config.brokerUsername || 'User';
                                               const cleanName = name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                                               return `${brokerName}-${middle} | ${cleanName}`;
                                           })()}
                                        </span>
                                   </div>
                                   <div className="flex items-center gap-1.5 flex-wrap">
                                       <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${typeColorClass} shadow-sm whitespace-nowrap min-w-[48px] w-auto flex items-center justify-center`}>
                                           {typeLabel}
                                       </span>
                                        <span className="text-[10px] font-bold text-zinc-500 font-mono tracking-wide whitespace-nowrap">
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
              <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#C8B085]/10 flex items-center justify-center text-[#C8B085]">
                                <ShieldCheck size={16} />
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                匯入帳戶對應 (ACCOUNT MAPPING)
                            </span>
                        </div>
                        
                        {/* Summary Logic with Selectors */}
                        {(() => {
                           // Generate a unique list of sources to render rows for
                           return (
                               <div className="flex flex-col gap-2 mt-1 w-full pl-11 pr-2">
                                   {selectedConfigIds.map(key => {
                                       const [confId, code, subIdxStr] = key.split('|');
                                       const subIdx = parseInt(subIdxStr || '0', 10);
                                       const conf = configs.find(c => c.id === confId);
                                       const branches = (conf?.branch || '').split(',');
                                       const branchName = branches[subIdx] || conf?.branch || 'Unknown';
                                       
                                       // Color Logic
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

                                       // Display Name Logic
                                       const name = conf?.alias || conf?.brokerUsername || 'User';
                                       const displayName = name.includes('永豐金') ? name.split('永豐金')[0].trim() : name;
                                       const middle = typeLabel === '期貨' ? '期貨' : branchName.replace(/\(.*\)/, '').replace('分公司', '');

                                       const currentTargetId = accountPortfolioMap[key] || targetPortfolioId;

                                       return (
                                           <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/5 pb-3 sm:pb-2 last:border-0 last:pb-0">
                                               {/* Source Label */}
                                               <div className="flex-1 flex flex-col gap-1.5">
                                                    {/* Row 1: Header */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-white tracking-tight">
                                                            永豐金-{middle} | {displayName}
                                                        </span>
                                                    </div>
                                                    {/* Row 2: Badge + Account */}
                                                    <div className="flex items-center gap-3 pl-0.5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeColorClass} shadow-sm whitespace-nowrap w-[52px] flex items-center justify-center`}>
                                                            {typeLabel}
                                                        </span>
                                                        <span className="text-[12px] font-bold text-zinc-500 font-mono tracking-wide">
                                                           {(() => {
                                                               const accList = (conf?.accounts || '').split(',').map(s => s.trim()).filter(Boolean);
                                                               const codeList = (conf?.branchCode || '').split(',').map(s => s.trim()).filter(Boolean);
                                                               const idx = branches.indexOf(branchName);
                                                               
                                                               // Robust Fallback
                                                               const displayAcc = accList[idx] || (codeList[idx]?.length >= 7 ? codeList[idx] : '');
                                                               return displayAcc;
                                                           })()}
                                                        </span>
                                                   </div>
                                               </div>
                                               
                                               <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto shrink-0">
                                                    <ArrowRight className="text-zinc-600 w-4 h-4 rotate-90 sm:rotate-0" />
                                                    {/* Target Selector */}
                                                    <div className="w-full sm:w-[160px]">
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
                           );
                        })()}
                    </div>
                </div>
              </div>

              <div className="max-h-[350px] overflow-y-auto pr-3 space-y-3 custom-scrollbar">
                {transactions.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-500/40">
                    <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
                      <CalendarDays size={24} className="opacity-20" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-black tracking-widest uppercase">
                        No Data Found
                      </p>
                      <p className="text-[10px] font-medium mt-1">
                        此區間無同步交易紀錄
                      </p>
                    </div>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="space-y-1">
                      <div
                        className={`px-2.5 py-2 rounded-2xl border transition-all flex items-start gap-2.5 relative group/item ${
                          !tx.selected
                            ? "bg-black/20 border-white/5 opacity-40 grayscale-[100%] hover:opacity-100 hover:grayscale-0 transition-all duration-300"
                            : tx.isDuplicate
                              ? "bg-gradient-to-r from-amber-500/5 to-transparent border-white/5 hover:border-amber-500/30 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]"
                              : "bg-[#1C1E22]/50 border-white/10 shadow-lg shadow-black/25"
                        }`}
                      >
                        {/* Left: Checkbox (Top aligned) */}
                        <input
                          type="checkbox"
                          checked={tx.selected}
                          onChange={() => toggleSelection(tx.id)}
                          className={`mt-1 w-4 h-4 rounded-md border-white/20 bg-black/40 focus:ring-0 cursor-pointer shrink-0 transition-all ${
                            tx.selected && tx.isDuplicate
                              ? "text-amber-500 border-amber-500/50"
                              : tx.isDuplicate && !tx.selected
                                ? "checked:text-amber-500/50" // Should not be checked usually
                                : "text-[#C8B085] border-[#C8B085]/30"
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
                                <div className="group/tooltip relative flex items-center gap-1 cursor-help transition-all hover:bg-amber-500/10 rounded px-1 -ml-1">
                                  <AlertTriangle
                                    size={10}
                                    className="text-amber-500/70"
                                  />
                                  <span className="text-amber-500/70 text-[8px] font-bold tracking-tighter uppercase group-hover/tooltip:text-amber-500 transition-colors">
                                    已匯入 ({tx.duplicateReason || '重複'})
                                  </span>

                                  {/* Tooltip Content */}
                                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/tooltip:block z-50 whitespace-nowrap">
                                    <div className="bg-zinc-900 border border-white/10 text-zinc-300 text-[9px] px-2 py-1 rounded-lg shadow-xl backdrop-blur-xl">
                                      {tx.duplicateReason ||
                                        "此交易已在記錄中存在"}
                                      {/* Arrow */}
                                      <div className="absolute left-2 top-full w-2 h-2 bg-zinc-900 border-r border-b border-white/10 transform rotate-45 -mt-1"></div>
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
                                {tx.pnl >= 0 ? "+" : ""}
                                {formatMoney(tx.pnl)}
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
                    CONNECTING...
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
              onClick={step === 1 ? handleFetch : handleConfirmImport}
              disabled={status === "loading"}
              className={`relative overflow-hidden px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg active:scale-95 
                            ${
                              status === "loading"
                                ? "bg-zinc-800 text-white w-full justify-center disabled:opacity-100 disabled:cursor-wait"
                                : "bg-[#C8B085] hover:bg-[#B09870] text-black shadow-[#C8B085]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                            }`}
            >
              {status === "loading" && (
                <div
                  className="absolute inset-0 bg-[#C8B085] transition-all duration-300 ease-out opacity-20"
                  style={{ width: `${loadingProgress}%` }}
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                {status === "loading" ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>{loadingMessage || "處理中..."}</span>
                    <span className="opacity-50 ml-1">{loadingProgress}%</span>
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
