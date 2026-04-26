# Changelog

All notable changes to this project will be documented in this file.

## [3.6.0] - 2026-04-25

### Phase 2 — 7 項中等改動：型別、資料層、同步、安全

#### Type safety
- **`src/types/trade.ts`** — 新增 `EquityPoint` / `DrawdownPoint` 型別。`Metrics.curve` / `drawdown` 從 `any[]` 收緊為強型別。`src/utils/calculations.ts` 同步用上新型別，圖表資料的 schema 不再是 free-for-all。

#### Data layer
- **`src/utils/migration.ts`** — localStorage → IndexedDB migration 加上 schema 驗證：`isValidTrade()` / `isValidPortfolio()` 把缺欄位 / 型別錯的舊資料**跳過並 log**，而非整批 bulkAdd 失敗造成 IndexedDB 進入空狀態。droppedItems 與 parseErrors 都會出現在 console 供追查。
- **`src/db/index.ts`** — 加上 schema versioning skeleton 註解 + 範例。將來新增 Trade 欄位時，照範例 `.version(2).stores(...).upgrade(...)`，避免直接修改 v1 stores 造成升級時資料破壞。
- **`src/hooks/useIndexedDBData.ts`** — `setTrades` / `setStrategies` / `setEmotions` / `setPortfolios` / `updateSettings(portfolios)` 全部包進 `db.transaction('rw', ...)`。原本 `clear() + bulkAdd()` 中間若 crash（quota / parsing / 連線中斷），表會留在空狀態 → **使用者全部資料消失**。

#### Sync correctness
- **`src/context/TradeContext.tsx`** — 新增 `scheduleCloudBackup()` debounced helper：350ms 內的多次 mutation 合併成一次 cloud push。取代散在各 action 裡的 `setTimeout(triggerCloudBackup, 0)`：
  1. **修正 stale closure**：350ms 給 React + Dexie `useLiveQuery` 充分時間 flush state 到 `dataRef`。原本 0ms 的 `setTimeout` 在 `dataRef` 更新前就 push，造成最新一筆 mutation 漏寫雲端。
  2. **節省雲端寫入額度**：rapid mutation（例如批次 import）原本每筆都 trigger 一次 backup，現在合併。

#### Security
- **`src/features/settings/components/BrokerSettings.tsx`** — Set3：元件 unmount 時把 `apiSecret` / `caPassword` / `caContent` 從 React state 抹掉。雖然 React 不會 expose state 給其他人，但 React DevTools / 記憶體 dump 都看得到，能短一點 lifetime 就短一點。
- **`src/features/settings/SettingsView.tsx`** — Set4：`<ImportConflictModal>` 從永遠 mounted 改為 `{isImportModalOpen && <…>}` 條件渲染。Modal 內部 useState 會跨 session 殘留，可能撈到前次未完成的選擇。

#### Deferred — 留待下一輪
- **C9** sync warnings → user-visible toast：需要新增 toast 基礎建設（目前無 toast 系統），scope 過大本輪 defer。

### Versions
- `package.json` 3.5.0 → 3.6.0（minor bump 反映資料層改動）

## [3.5.0] - 2026-04-25

### Phase 1 — 11 項低風險修復批次

由 cross-page audit 找出來的快速勝利。每項都 LOW risk + 5–30 分鐘工時。

#### Bug — 計算正確性
- **`src/utils/format.ts`** — `formatDecimal(Infinity)` 改回傳 `—` 而非 `∞`。R:R 與 Profit Factor 在「無虧損／無獲利」時的 `Infinity` 對使用者沒有意義（新帳號最常見），改用 em-dash 表示「資料不足以計算」。同步移除 `ShareCardModal.tsx:321` 寫死的 `=== Infinity ? '∞'` 判斷，統一走 formatDecimal。
- **`src/App.tsx`** — `monthlyStats` 勝率分母排除 PnL=0 的交易。原本「10 筆全平手 + 5 筆獲利」會被算成 33% 勝率，現在只算「有盈或虧的決定性交易」。

#### UX
- **`src/features/calendar/CalendarView.tsx`** — 月曆年/月選擇器加上「不能超過今天的隔月」的上限，防止使用者滑到 2099 年看一堆空白。超出的月份顯示 disabled。
- **`src/features/calendar/CalendarView.tsx`** — 月曆 cell 加 `min-h-[44px]` 確保 iPhone SE 等小螢幕的觸控區符合 WCAG AAA。
- **`src/features/settings/SettingsView.tsx`** — Cloud Restore 從 `window.confirm()` 改為 inline two-step confirm（按一次轉紅色「再按一次確認覆蓋」、3 秒不操作自動取消）。瀏覽器擋掉 `confirm()` dialog 就會直接覆蓋本地全部資料，這修補的是真正的資料安全洞。
- **`src/features/dashboard/components/StatsTab.tsx`** — 「Long press to select range」提示改為 mobile 預設半透明常駐、desktop 維持 hover 才顯示（`opacity-40 sm:opacity-0 sm:hover:opacity-100`）。原本 `opacity-0 hover:opacity-100` 在手機完全看不到。

#### 型別 / 維護性
- **`src/context/TradeContext.tsx`** — `updatePortfolio` 簽名 `(k: any, v: any)` 收緊為 `(k: keyof Portfolio, v: Portfolio[keyof Portfolio])`。底層 `useIndexedDBData` / `useLocalData` 早就是 `keyof Portfolio`，只是 context wrapper 鬆掉。
- **`vite.config.ts`** — Google Fonts cache 從 365 天縮為 30 天，bug fix 與字型更新能更快被使用者拉到。
- **`src/hooks/useIndexedDBData.ts`** — `addStrategy` / `addEmotion` 的 try/catch 區分 `ConstraintError`（duplicate，靜默吞掉）與其他錯誤（quota exceeded、版本不符等，要 console.error 並 throw 出來）。原本一律當「already exists」吞掉會造成 silent data loss。

#### 已調查但 audit 誤報、無需修
- **Set2** TradeModal share image — `finally { setIsSharing(false) }` 早就有了
- **S3** Stat card cursor — `cursor-pointer active:scale-95` 早就存在於 `hideAmounts` 條件下

### Versions

- `package.json` 3.4.1 → 3.5.0（minor bump 反映多項修復）

## [3.4.1] - 2026-04-25

### Fixed — v3.4.0 兩個視覺 bug

使用者在 v3.4.0 上線後立刻回報「記錄」頁兩個問題：

#### 1. 中文股名重複（`6147 頎邦 頎邦`）
**`src/utils/symbolNames.ts`** line 154-156：當 broker 同步進來的 `code` 已經把名字塞在字串裡（例如 `"6147 頎邦"`），`formatSymbolCode` 會拆出 `firstToken="6147"` 與 `rest="頎邦"`，再從 `STOCK_NAME_MAP` 查到 `"6147" → "頎邦"`，最後回傳 `"6147 頎邦 頎邦"` — **把查表結果跟既有的 rest 雙寫**。

修法：先比對 rest 是否已經等於 / 包含查表結果，已經有就不再追加。`"6147"` 單代號路徑（line 161-165）不變，仍正常回 `"6147 頎邦"`。

#### 2. 交易時間顯示錯誤（所有交易都是 17:07）
**v3.4.0 加的 time badge 是判斷錯誤**。`Trade.timestamp` 在 `src/hooks/useIndexedDBData.ts:103` 是 `t.timestamp || now` — broker 同步進來的 `TransactionDetail` 本來就沒 timestamp 欄位，全部會 fallback 到 `now`，也就是「同步那一刻」，**不是真正的成交時間**。Shioaji 的 `list_profit_loss` 也只回傳日期不含時:分。

修法：`src/features/history/LogsView.tsx` 移除 `formatTradeTime` 函式與 info line 中的時間元素，info line 回到 `{name} | {qty} | {pts/yield}` 樣貌。註解說明為什麼不能用 timestamp，避免之後又有人不查資料源把它加回來。

### Out of scope（未來想做時的線索）

要顯示真正的成交時間需改抓 Shioaji `list_trades` endpoint（與 `list_profit_loss` 不同），會帶 `ts` 欄位（成交時間 epoch）。本輪不做。

### Versions

- `package.json` 3.4.0 → 3.4.1

## [3.4.0] - 2026-04-25

### Improved — 「記錄」(Records / Trading History) 視覺與資訊密度

使用者反映同一天看到「同代號同口數同 %」的兩筆交易在 UI 上幾乎一模一樣，無從判斷哪筆是哪筆，且不容易看出當日總盈虧。本次優化補上幾個低風險高價值的改動：

### Added — `src/features/history/LogsView.tsx`

- **每日盈虧小計**：在每個日期 pill（例如 `2026/04/27`）後直接顯示當日所有交易的合計（`+23,100` / `-5,498`），符合既有的綠／紅配色，並在 `hideAmounts` 模式下會自動模糊，不違背隱私設定。
- **每筆交易時間戳記**（HH:MM, 24h）：若 `Trade.timestamp` 存在，顯示在 info line 最前（`09:34 | 5498 凱崴 | 2張 | -13.58%`）。手動建立的交易不會有 timestamp，會自動跳過。永豐金 Shioaji 同步進來的交易會帶 timestamp，這對區分當日多筆同代號交易特別有用。

### Changed

- **排序按鈕從 3 顆變 2 顆**：原本「日期 / 獲利優先 / 虧損優先」三顆並排佔很大版面。改為「日期 / PnL」兩顆，**PnL 按鈕再按一次切換方向**：
  - 第一次按：高到低（↓ 代表越往下越小）
  - 再按一次：低到高（↑ 代表越往下越大）
  - 圖示用 `lucide-react` 的 `ArrowDown` / `ArrowUp` 取代原本的 `ArrowUpDown`
  - i18n 標籤沿用既有 `sort_pnl_high` / `sort_pnl_low`，不需新增翻譯

### Versions

- `package.json` 3.3.3 → 3.4.0（minor bump 反映 UX 改動）

### Deferred — 等使用者確認後再做

| 項目 | 為什麼先不做 |
|------|-------------|
| 手機按鈕一律顯示（編輯／刪除目前 hover 才出現） | 需確認版面密度 |
| 點整列展開明細 | 需設計詳細頁 |
| 大量資料虛擬化（1000+ 筆） | 重構大、目前無實際 perf 問題 |
| 抽出 `<PnLCapsule>` 元件去重 | 純程式碼整理，無使用者價值 |

## [3.3.3] - 2026-04-25

### Fixed — Render logs 終於指出真兇

v3.3.2 加的 `[STAGE]` instrumentation 立刻揭露了被遮蔽多輪的真正 bug。RSS 全程穩定 71MB（v3.3.1 OOM 修復成功），所有 Shioaji 呼叫都 < 0.3 秒，根本沒有任何「卡住」— 但**期貨帳號的 PnL 抓取一直拋型別錯誤**，加上前端輪詢迴圈又有 v3.3.0 引入的 regression，造成「卡 4 分鐘超時」的假象。

### Backend — `backend/core/pnl.py`

- **`list_profit_loss` 期貨帳號型別錯誤**：Shioaji 1.3.3 對 `list_profit_loss` 的 `begin_date` / `end_date` 參數型別**因帳號類型而異**：
  - **股票帳號**：要 `datetime.date`（v3.1.1 修過此問題）
  - **期貨帳號**：要 `str`（傳 `datetime.date` 會拋 `Argument 'begin_date' has incorrect type` — 這就是 user 期貨同步永遠拿 0 筆的原因）
  
  改為依 `is_futures` 旗標傳對應型別；並補上 type-swap 重試機制（若 Shioaji 未來再改型別簽名，自動嘗試另一種型別後再放棄）。

### Frontend — `src/services/brokerService.ts`

- **Polling 永不結束的 regression（v3.3.0 引入）**：當後端 job 狀態為 `error`，原本是在 try block 裡 `throw new Error(job.error)`，但同層的 catch block 會接住並把它當作網路錯誤累計到 `consecutiveFailures`。下一輪 poll 又因為 HTTP 200 把 `consecutiveFailures` 重置為 0，永遠到不了 `MAX_CONSECUTIVE_FAILURES`，polling 持續整個 5 分鐘預算。修法：改用 `jobErrorMsg` sentinel 帶出迴圈，跳過 catch。
- **同步 4xx 不該 fallback 到 async**：原本同步路徑遇到後端邏輯錯誤（4xx，例如本次的期貨 date 錯誤）會被 catch 接住、當作網路問題又跑一次 async — 浪費時間，且兩條路都會撞同個 bug。改用 `syncBackendError` sentinel，4xx 直接拋出，只有純網路 / timeout 才走 async fallback。

### Versions

- `package.json` 3.3.2 → 3.3.3
- 後端 `/` endpoint `v1.5.2` → `v1.5.3`

## [3.3.2] - 2026-04-25

### Diagnostic — PnL 取得各階段計時 + 記憶體紀錄

使用者持續看到「正在下載 X 的交易資料... 50%」卡住很久，但 v3.3.1 已修了 OOM。為了停止猜測、直接看到資料，本次加上後端分段計時：

### Added — `backend/core/pnl.py`

- **`_rss_mb()`**：讀 `/proc/self/status` 取得目前 process 的 RSS 記憶體（MB），用於 Render free tier 512MB OOM 監控。
- **`_Stage` context manager**：包住一段流程，進入時印 `⏱️  [STAGE] X start (rss=NMB)`，結束時印 `⏱️  [STAGE] X done in T.TTs (rss=NMB)`。失敗時印 `FAIL`。
- **`login_and_fetch_pnl` 全程 instrument**：
  - `[REQUEST START]` 印 person_id 末三碼、日期區間、profile_only、起始 RSS
  - 階段 `get_api (login or reuse)` — 量測 session 重用 vs 全新登入耗時
  - 階段 `ensure_ca_active` — 量測 CA 啟動耗時（這次改為 `force=False`，預期大幅縮短）
  - 階段 `list_accounts` — 量測取得帳號清單耗時
  - 階段 `fetch acc {id} [i/total]` — 每個帳號的 PnL 抓取耗時（含 list_profit_loss + parsing）
  - `[Done]` 多印 `total_request=T.TTs` 與 `rss_end=NMB`
- **`backend/core/session.py`**：health check 完印 `health check took T.TTs, ok=true/false`

### Changed

- **`force=True` CA 重啟取消**：`login_and_fetch_pnl` 改為 `manager.ensure_ca_active(..., force=False)`，依靠 session 內建的 `_CA_EXPIRY_SECONDS=1800` 機制。原本每次 PnL 強制重啟 CA 會多花 0.5-2 秒，且若 CA 真的失效，list_profit_loss 階段的 retry 機制能補救。

### How to use

部署後跑一次同步，去 Render dashboard → tradetrack-backend → Logs → 找 `=== PNL REQUEST ===` 之後的內容。期望看到類似：

```
⏱️  [STAGE] get_api (login or reuse) start (rss=140MB)
⏱️  [STAGE] get_api (login or reuse) done in 0.18s (rss=145MB)
⏱️  [STAGE] ensure_ca_active start (rss=145MB)
⏱️  [STAGE] ensure_ca_active done in 0.05s (rss=145MB)   # 因為 force=False 通常會跳過
⏱️  [STAGE] list_accounts start (rss=145MB)
⏱️  [STAGE] list_accounts done in 1.42s (rss=148MB)
⏱️  [STAGE] fetch acc 0264298 [1/1] start (rss=148MB)
⏱️  [STAGE] fetch acc 0264298 [1/1] done in 3.78s (rss=152MB)
✅ [Done] PnL=12345, Items=8, Equity=0 | total_request=5.43s, rss_end=152MB
```

如果某一段顯示 30s+，那就是真正的瓶頸。

### Versions

- `package.json` 3.3.1 → 3.3.2
- 後端 `/` endpoint `v1.5.1` → `v1.5.2`

## [3.3.1] - 2026-04-25

### Fixed — Render free tier OOM 中斷同步

**症狀**：使用者在 v3.3.0 上點同步，畫面卡在 32% 進度，Render 同時通知：

> An instance of your Web Service TradeTrack-Pro exceeded its memory limit, which triggered an automatic restart.

**根因**：Render free tier 只有 **512MB RAM**。`session.py:110` 在 `api.login()` 時把 `fetch_contract=True` 寫死，這會讓 Shioaji 把整個台股+期貨的契約資料下載到記憶體（**~200MB**），加上 Flask + gunicorn + Python runtime 基礎佔用（~150MB）+ PnL 暫存資料就把 512MB 撐爆。容器被 Render 殺掉時 sync HTTP 請求斷線，前端就停在等回應的 32%。

**修復**：

- **`backend/core/session.py`**：`get_api()` 新增 `fetch_contract: bool = False` 參數。預設 **不** 抓契約資料 — `list_profit_loss` / `margin` / `list_positions` / `list_accounts` 完全不需要 `api.Contracts`，多年都白吃這 200MB。會檢查 cached session 是否帶契約，若需求變動會自動重新登入。
- **`backend/core/pnl.py`**：`verify_simulation_account` 顯式傳 `fetch_contract=True`（因為要呼叫 `api.Contracts.Stocks` 取得測試商品下單）；其餘 PnL / profile 路徑沿用預設 `False`。
- **`backend/core/pnl.py`**：`login_and_fetch_pnl` 的 `finally` 區塊新增 `gc.collect()`，在 PnL 抓取結束時主動釋放 `pnl_data` items / parsed dicts 等暫存物件，避免下個請求進來時繼續累積到 OOM 邊緣。

### Impact

- 基礎記憶體佔用從 ~350MB → **~150MB**
- 預期 Render free tier 上 1 帳號 30-90 天的 PnL 同步不再會 OOM
- 大量帳號 / 長區間查詢仍可能受 512MB 限制；徹底解法是付費方案或 Persistent Disk

### Versions

- `package.json` 3.3.0 → 3.3.1
- 後端 `/` endpoint `v1.5.0` → `v1.5.1`

## [3.3.0] - 2026-04-25

### Architectural — PnL 改回同步請求，繞開 ephemeral disk

**問題根因（v3.2.x 都修不掉）**：
v3.0.4 引進的 async + polling job 系統依賴後端**跨多次 HTTP request 記住 job 狀態**。Render free tier 的容器磁碟是 ephemeral — 容器一被殺（休眠/被重啟/redeploy），SQLite 整個檔消失。即使 v3.2.0 加了持久化、v3.2.1 改單一連線、v3.2.3 補診斷訊息，**只要 Render 在 polling 中途重啟一次容器，job_id 就再也找不到**，前端就回報「同步任務遺失」。使用者實測證實確實如此。

**根本解法**：
登入 (`/api/broker/profile`) 從來都用同步單一 HTTP request 而且**完全沒這問題** — 因為連線開著時 Render 不會殺 worker。本次把 PnL 改回同樣模式：

### Changed

- **`src/services/brokerService.ts`**：`fetchBrokerPnl` 重新組織為 **sync-first**：
  1. **首先**呼叫 `/api/broker/pnl`（同步），110s client timeout（在 gunicorn 120s 之內）。一次來回拿到結果，**根本繞開 job state 跨請求記憶這個問題層**。
  2. **失敗才** fallback 到 async `/api/jobs/pnl`（保留作為大量資料的保險，但對 99% 的日常同步都用不到）。
  3. 4xx 錯誤（API key 無效、CA 失效）直接拋，不會無謂地走 async 重試。

- **`backend/app.py`**：`/api/broker/pnl` 同步 endpoint 也回傳 `account_summaries` / `empty_diagnostic` / `date_range_used`（v3.2.3 只更新了 async 那條路，這次補齊）。

### Why this is the right fix

| 層 | Async path | Sync path (this PR) |
|---|----|----|
| Render 重啟 mid-fetch | Job 遺失，無法復原 | 連線開著 = Render 不殺 |
| Ephemeral disk | 致命，SQLite 消失 | 不需要 |
| Cold start | 第一次 polling 可能 404 | 第一次請求自然等候啟動 |
| Debug 難度 | 需追蹤 job_id 跨多請求 | 單一 request/response |
| 單一帳號 30 天查詢 | 過度工程 | 剛好 |

Async 路徑保留作為超大查詢（多帳號 + 多月）的 fallback，但日常使用的成功率與訊息清晰度都會大幅改善。

### Versions

- `package.json` 3.2.3 → 3.3.0（minor bump 反映架構改動）
- 後端 `/` endpoint `v1.4.2` → `v1.5.0`

## [3.2.3] - 2026-04-25

### Diagnostic — 損益取得失敗時提供逐帳號診斷

使用者回報：可以登入券商但取得損益有問題，原本錯誤訊息只有籠統的「查無交易紀錄」，無法判斷是 CA 失效、帳號未授權、複委託不支援，還是區間內真的無交易。本次補上完整診斷鍊：

### Added

- **`backend/core/pnl.py`**：聚合階段建立 `account_summaries[]`，記錄每個帳號的 `record_count`、`pnl`、`signed`、`status` (`ok` / `empty` / `error` / `skipped`)、`reason`（明確中文訊息：「CA 憑證未啟動」、「帳號尚未授權簽署」、「複委託暫不支援」、「此區間內無交易紀錄」）。
- **`backend/core/pnl.py`**：當 `details = []` 但無錯誤時，組裝 `empty_diagnostic` 字串：例如「CA 未啟動 (1234567890)；帳號未授權 (0987654321) — 請至「帳號管理」執行驗證；此區間 2026-04-15~2026-04-25 內 5566778899 確實無交易」。
- **`backend/core/pnl.py`**：回應新增 `date_range_used`，方便前端確認後端實際查詢的區間（在 end_date 超過今天時會被自動截斷）。
- **`backend/app.py`**：`/api/jobs/pnl` 完成時把 `account_summaries` / `empty_diagnostic` / `date_range_used` 一併寫進 `final_result`。
- **`src/types/broker.ts`**：新增 `AccountSummary` 型別與 `BrokerSyncResult.{accountSummaries,emptyDiagnostic,dateRangeUsed}` 欄位。
- **`src/services/brokerService.ts`**：把後端新增的三個欄位映射到 `BrokerSyncResult`。
- **`src/components/modals/SyncDateModal.tsx`**：累積 `emptyDiagnostics`，在「成功但 0 筆交易」情境下顯示「同步成功但 0 筆交易：{逐帳號診斷}」，取代以往黑盒子的「查無交易紀錄」。

### Versions

- `package.json` 3.2.2 → 3.2.3
- 後端 `/` endpoint `v1.4.1` → `v1.4.2`

## [3.2.2] - 2026-04-25

### Fixed — UI 顯示版本與實際 build 不一致

- **`src/constants.ts`**：`APP_VERSION` 原本是手動硬編碼為 `V3.0.3`，從 v3.0.3 release 後就再也沒人更新過。即使 package.json 一路推到 3.2.1、Zeabur / Netlify 也照新 commit build，畫面右下角仍顯示 `V3.0.3`，導致使用者無從區分手中的 PWA bundle 是新是舊。
- **改為 build-time 注入**：`vite.config.ts` 讀取 `package.json` 的 `version`，透過 `define: { __APP_VERSION__: ... }` 注入到 bundle；`constants.ts` 改成讀取該全域常數。未來只要 bump `package.json`，UI 跟 npm 版本就會永遠一致，不需手動同步。
- **`src/vite-env.d.ts`**：新增 `declare const __APP_VERSION__: string;` 讓 TypeScript 認得這個 build-time 注入的常數。

### Why this matters

合併 v3.2.0 / v3.2.1 後，使用者重新部署 Zeabur 前端、發現畫面仍顯示 `V3.0.3`，誤以為部署沒成功 — 實際上 `APP_VERSION` 從未跟著 `package.json` 走。本次改動之後，**畫面右下角的版本字串就是線上實際運行的 bundle 版本**，可作為「Zeabur / Netlify 是否真的拉到新 commit」的視覺檢核工具。

## [3.2.1] - 2026-04-24

### Optimized — 同步熱路徑效能與安全

- **SQLite 單一常駐連線** (`backend/core/job_store.py`)：原本每次 `create_job` / `update_progress` / `get_status` 都 `sqlite3.connect()` 再關閉；在 polling 熱路徑（每 1.5–5s 打一次）這筆開銷是不必要的。改用模組層級的常駐連線 + `check_same_thread=False` + `PRAGMA synchronous=NORMAL`，配合既有 WAL 模式與 `_lock` 序列化寫入。實測 8 執行緒 × 20 次 create 在 13ms 內完成。
- **前端 Polling 指數退避** (`src/services/brokerService.ts`)：原本固定 2s polling × 150 次 = 300 次 HTTP request；改為前 5 次 1.5s（抓早期登入階段進度）之後依 `job.progress` 線性拉到 5s 上限。平均每次同步請求數降低約 40–50%，免費雲端 egress 與 CPU 壓力顯著下降。

### Security

- **PII 遮蔽** (`backend/app.py`)：原本 DEBUG 日誌直接印 `personId` 與 `accountId`（身分證字號 / 帳號），改以 `_mask_id()` 只露尾 3 碼 (`***123`)，避免雲端日誌保留造成的個資外流。
- **臨時 CA 檔清理** (`backend/core/pnl.py`)：`login_and_fetch_pnl` 若以 `ca_content` 建立 `temp_ca_path`，原本只有成功路徑沒清；在 `finally` 補上 `os.unlink()`，避免免費雲端磁碟配額累積。

### Versions

- `package.json` 3.2.0 → 3.2.1
- 後端 `/` endpoint `v1.4.0` → `v1.4.1`

## [3.2.0] - 2026-04-24

### Fixed — 券商同步「伺服器已重新啟動」錯誤

- **根本原因**：`backend/core/job_store.py` 原本以記憶體 dict 儲存背景同步任務。免費雲端後台 (Render / Zeabur free tier) 因閒置休眠或冷啟動重啟 Flask process 後，`_jobs` 被清空，前端輪詢 `/api/jobs/:id/status` 收到 404 → 顯示「同步失敗：伺服器已重新啟動，同步任務遺失」，使用者無從分辨是「雲端休眠」「券商 API」還是「憑證問題」。
- **修復**：改以 SQLite (`backend/jobs.db`) 持久化 job metadata；**不儲存任何憑證或 payload**，僅保留狀態、進度、結果、錯誤訊息。伺服器重啟後任務狀態仍可查得。

### Added

- **啟動時 Orphan 恢復機制**：`job_store.recover_orphaned_jobs()` 於 Flask 啟動時呼叫，將上一輪仍在 `pending` / `running` 的任務標記為 `error`，並附明確訊息：「伺服器在同步過程中重啟（常見於免費雲端閒置休眠），背景任務已中斷，請重新執行同步。」避免使用者在前端看到無意義的 404。
- **前端 404 容忍重試**：`brokerService.ts` 輪詢 job status 時若收到 404，先連續重試 3 次（每 2 秒）再放棄，以容忍冷啟動瞬斷；放棄後顯示指向雲端方案本身的訊息，引導使用者重試或升級方案。
- **後端 404 回應增加 `reason` 欄位**：`/api/jobs/:id/status` 與 `/api/jobs/:id/result` 在任務不存在時回 `{ status: "error", reason: "job_not_found", message: "..." }`，便於前端分類處理。

### Changed

- **Job 保留時間由 1 小時 → 24 小時**：`cleanup_old_jobs()` 預設 `older_than_seconds` 由 `3600` 調整為 `86400`，避免使用者慢了一拍就撈不到結果。
- **版本號同步**：`package.json` 3.0.4 → 3.2.0（補齊 CHANGELOG 進度並反映此次架構改動）；後端 `/` endpoint 回報的 `version` 由 `v1.3.1` → `v1.4.0`。

### Verification

- 後端新增 7 項端到端測試（CRUD、錯誤流程、orphan 恢復、冪等性、missing job、concurrent create、cleanup 24h），全部通過。
- `.gitignore` 排除 `backend/jobs.db*` 等 SQLite 執行期檔案。

## [3.1.1] - 2026-04-12

### Fixed — 券商同步根本問題修復

- **`list_profit_loss` 型別錯誤**：Shioaji SDK 要求傳入 `datetime.date` 物件，舊版誤傳字串導致靜默回傳空值。現於 `_fetch_single_account` 中強制轉型，並補齊錯誤日期格式的 early-return 保護。
- **CA 憑證狀態偽陽性**：`activate_ca` 在部分 SDK 版本回傳 `None` 而非 `False` 表示失敗，原先 `if result is False` 判斷遺漏此情況，導致 CA 狀態被誤標為「已啟動」。改以 `if not result` 統一攔截。
- **CA 本地快取遮蔽 Shioaji 內部失效**：Session 中的 `ca_activated` 旗標（最長快取 30 分鐘）無法反映 Shioaji 底層 CA 狀態的實際失效。修復方式：PnL 查詢前一律以 `force=True` 強制重新呼叫 `activate_ca`，確保狀態同步。
- **CA 啟動失敗訊息模糊**：現區分三種情況給出對應提示——①已上傳 caContent 但 activate_ca 未成功（密碼可能錯誤）、②雲端找不到 .pfx 檔案（需重新上傳）、③其他啟動失敗。
- **日期範圍未驗證**：新增後端防護——起始日晚於結束日直接回傳明確錯誤；結束日超過今天自動截斷為今天，不再送出無效請求給 Shioaji。
- **例外分類過於籠統**：後端最外層 `except` 現對常見錯誤分類為使用者友善訊息（API Key 無效、帳號授權、CA 錯誤、登入逾時、網路連線失敗、環境不符），取代原本直接拋出 SDK 原始訊息。
- **`caPath` 驗證阻斷雲端部署**：所有後端端點（`/api/broker/profile`、`/api/jobs/pnl`、`/api/broker/verify`）的必填欄位驗證改為接受 `caPath` 或 `caContent` 二擇一，不再強制需要本地路徑。

### Added

- **每日損益彙總回應**：後端 PnL 回應新增 `daily_results` 欄位，前端不再需要自行計算。
- **CA 狀態與空資料原因欄位**：`BrokerSyncResult` 新增 `caStatus`、`emptyReason`，供前端區分「CA 未啟動」與「區間無交易」兩種空值情況。
- **前端型別補齊**：`TransactionDetail` 新增 `entryPrice`、`exitPrice` 可選欄位。

### Changed — 行動端同步體驗優化

- **智慧日期預填**：`SyncDateModal` 開啟時自動將起始日設為上次同步結束日的隔天，終止日設為今天，省去手動調整。
- **「上次至今」快速按鈕**：有上次同步紀錄時顯示，一鍵還原最常用日期範圍。
- **連線後自動同步 (`autoSyncOnWake`)**：後端從休眠恢復為 online 後，自動觸發同步，不需使用者再次點擊。
- **休眠覆蓋層重設計**：顯示「同步意圖卡」預覽即將同步的日期與帳號數，並提供自動同步開關，取代原本僅顯示旋轉動畫的等待畫面。
- **Footer 按鈕語境化**：休眠/連線中狀態下按鈕樣式改為藍色，文字顯示「連線後自動同步」或「立即啟動同步」。

### Infrastructure

- **`BackendContext` 重構**：改為訂閱 `backendGateway` 單一狀態來源，移除冗餘的獨立 health check 輪詢與 30 秒計時器。
- **`useBrokerStatus.ts` 移除**：功能已整合至 `BackendContext`，廢棄檔案刪除。
- **Render worker 調整**：`gunicorn` workers 從 2 調整為 1，加入 `--timeout 120`，減少 Render 免費方案記憶體壓力。
- **Zeabur 部署 Node 環境修正**：於 `package.json` 加入 `engines` 強制指定 Node.js 20 以上版本，根治靜態部署時容器自動執行 `npm update -g npm` 而拋出 `promise-retry` 遺失的崩潰問題。

## [3.0.3] - 2026-03-19

### Performance
- **後端架構革新與效能破界 (Cloud PnL Speedup)**：
  - 徹底移除了 Shioaji 執行環境在 `is_futures` 判斷時的同步延遲策略與重試邏輯，改採「Sequential-Fast 平行化」查詢架構。
  - 雲端環境（Render）在喚醒 (熱啟動) 狀態下，現在讀取完整 11 個月、雙帳戶（期貨 + 台股）資料僅需 **6 小秒**，效能直接飆升，不再發生數分鐘阻塞！

### Fixed / Changed
- **前端智慧請求整併 (UI Request Grouping)**：修復了前端 `SyncDateModal` 中因為「不同掛載目標投資組合」而將期貨和證券的查詢「被硬性拆分為 6 大塊」的 UI 迴圈邏輯。現在前端無論勾選多少個券商帳戶，皆會 100% 打包成單一請求，並根據回傳 Payload 自動智慧導流進相對應的 Portfolio，徹底杜絕重複 Login Shioaji 的延遲。
- **UIUX 元件左對齊強迫症修復**：修正 `BrokerSettings.tsx` 中「取得 API 金鑰與憑證」與「輸入用戶資訊」容器不在同一個基準垂線的問題。現在會將文案統整為外層 `h5` 標題（並附上 `pl-1`），同時精簡活動框 (Action Box) 中多餘的敘述，讓兩顆按鈕 (`查看開通步驟`、`前往申請`) 平衡且完美對稱填滿空間。
- **「0開頭」複委託誤判阻斷**：修復了 `backend/core/pnl.py` 裡過度嚴苛的防呆正規檢查——原本帳戶名稱若為 0 開頭 (如 `0264298`) 會無條件被判定成 `SubBrokerage` 並遭後端剔除。修改後將全面依賴券商端 API 發出的 Type Enum 來作為唯一認定標準。

## [3.0.2] - 2026-03-18

### Fixed
- **完全修復 Zeabur Frontend `502 Bad Gateway` 錯誤**：捨棄 Docker 方案，改採 Zeabur 原生靜態邊緣託管 (Native Static Edge Hosting)，並新增 `zeabur.json` 徹底消除 Port 橋接失敗問題。
- **優化後端喚醒流程**：將 `validateBackendStatus` 逾時從 90 秒縮短至 8 秒，並導入狀態查詢連線指數退避 (Exponential Backoff) 輪詢，不會再因為長線程阻塞 UI，或導致無窮盡的渲染重置。
- 修復 `SyncDateModal` 自動 Ping 迴圈競態條件。
- 修復券商損益匯入時，如果後端處於 502 冷啟動狀態會產生「JSON 格式無法解析」的誤導錯誤，現在會正確顯示「後端冷啟動中」的提示。

## [3.0.1] - 2026-03-16

### Changed (Features & Architecture)

- **券商損益大數據匯入優化 (Data Chunking)**：
  - **前端智能分塊**：查詢大於一整個月的區間時，前端會自動拆分為多個 30 天的小片段 (Chunks) 並循序向後端請求，徹底解決 Shioaji 大區段查詢導致的 `Timeout` 或崩潰問題。
  - **動態進度回饋 (Progress UI)**：因應分塊查詢時間拉長，介面上會完整顯示目前的下載進度 (例如：`正在下載: 區塊 1/12...`) 與動態進度條。
  - **圖表視覺優化**：縮小並柔化了周/月頻率圖表中的「創歷史新高」點位，讓主視覺不再被點位過度干擾。
  - **UI 防遮擋修復**：新增 iPhone 動態島 (Dynamic Island) 與瀏海 (Notch) 的 `safe-area-inset-top` 邊距支援，防止頂部元件被系統 UI 遮擋。

### Fixed

- **靜默失敗阻斷 (Fail-Fast Error Propagation)**：修復舊版後端在遇到券商連線異常時，誤將空陣列與 `success` 回傳給前端導致的資料遺漏。現在發生異常會嚴格回傳 Error 中斷前端匯入。
- **解決多帳號連續查詢失敗 (CA Persistent File Fix)**：修復「同時勾選期貨與證券帳號」時，Shioaji C++ 底層因暫時 `.pfx` 憑證檔被提前刪除而發生的簽名崩潰，現在後端會以 `person_id` 為基礎穩定留存暫存憑證供重複連線使用。

## [2.5.11] - 2026-03-16

### Changed (Features)

- **資料存儲與同步架構全面升級**：
  - **智慧合併**：衝突發生時提供「智慧合併」選項，自動以 ID 比對合併雲端與本地資料。
  - **自動去重**：不論是同步拉取或智慧合併，系統皆會自動偵測並移除重複交易紀錄。
  - **登出自動備份**：優化登出流程，登出清空本機資料前會自動觸發雲端備份，防止資料遺失。
  - **衝突預覽**：解決衝突時會顯示本地、雲端與可能重複的資料筆數概覽。

## [2.5.10] - 2026-03-16

### Fixed

- **Zeabur 502 Bad Gateway 優化**：新增 `zbpack.json` 強制指定靜態網站打包輸出，並同時在 `package.json` 中加入 `serve` 作為 fallback 啟動腳本。確保不論 Zeabur 將專案識別為 Static 還是 Node.js 服務，都能正確監聽連接埠並部署 SPA，徹底根除 502 路由異常。

## [2.5.9] - 2026-03-12

### Fixed

- **雲端部署 502 Bad Gateway 修復**：移除了 `zeabur.toml` 中前端服務多餘的 `start = "npm run preview"` 指令，讓 Zeabur 能夠正確使用 Nginx 託管靜態路由，徹底解決手機版與網頁版存取時發生的 502 錯誤與白畫面問題。

## [2.5.8] - 2026-03-02

### Changed (Optimizations)

- **API 效能與穩定性優化**：移除後端 `ensure_ca_active` 的重複呼叫，每次請求減少約 500ms 延遲，並降低 Shioaji API 狀態異常風險。
- **憑證檢測 (CA Probe) 智慧化**：精準區分帳號類型，期貨帳號使用 `margin()` 偵測，股票帳號自動切換為 `list_positions()`，徹底消除股票帳號的系統誤報。
- **前端狀態處理防護**：大幅強化 `useMetrics` 對邊界值的容錯能力，過濾無效或空日期的交易、新增 NaN 排序防護，及 `dailyPnlMap` 日期格式驗證，提升系統整體穩定性與崩潰防護。
- **前端時區相容性優化**：`SyncDateModal` 全面改用 `/` 分隔符強制本地時間解析，完美避開 iOS / Safari 瀏覽器底層的 UTC 時區自動偏移問題。

### Fixed

- **匯入資料不顯示修正**：修復手機板匯入交易損益後，權益曲線、紀錄、日曆全部空白的核心問題。主因為更新後 `portfolioId` 未正確加入 `activePortfolioIds`，導致被過濾。
- **匯入欄位遺漏**：`handleSyncSuccess` 補齊 `price`、`raw_yield`、`yield`、`points` 四個關鍵欄位，解決 LogsView 報酬率與點數顯示空白的 Bug。
- **後端日期解析強化**：`pnl.py` 新增支援 `datetime.date` 物件、`20250401`、`2025-04-01` 等多種格式，解決永豐 API 跨版本回傳格式差異所造成的 NaN 問題。
- **期貨報酬率計算修正**：精準加入期貨合約乘數（如台指期 200、小台 50、電子期 4000 等），修正以往可能將 1% 獲利誤算為 200% 的嚴重計算偏差。

## [2.5.7] - 2026-02-26

### Fixed

- **同步資料顯示異常**：修復 API 回傳特定日期格式 (如 `.` 或 `/`) 導致 Safari/iOS 時間軸位移與無回退渲染的錯誤，全面正規化日期為 `YYYY-MM-DD` 並統一至當地時間顯示，解決圓圈標記無法顯示的問題。

## [2.5.6] - 2026-02-25

### Changed

- **設定檔分析效能**：Ghost / Duplicate 偵測邏輯改用 `useMemo` 快取，避免每次 render 重新計算。
- **一鍵修復可讀性**：將 100 行 `onClick` 內嵌邏輯抽取為獨立 `handleFixConfigIssues` 函式。
- **帳戶刪除體驗**：移除 `window.confirm` 彈窗，改為 inline 紅色確認按鈕（2 秒無操作自動收回），符合暗色系 UI 風格。
- **登出 Modal 語系**：說明文字與按鈕文案跟隨語系切換（中文 / 英文），不再全英文 hardcode。
- **帳戶儲存優化**：`AccountRow.handleSave` 合併連續兩次 `updatePortfolio` 為 batch update。

### Fixed

- **雲端憑證驗證**：`caPath` 驗證改為同時接受 `caContent` (base64)，雲端部署用戶不再被攔截。
- **重複 import 清理**：合併分散的 `useEffect` import 至主 React import。
- **重複註解清理**：移除 `SettingsView` 中重複的元件標頭註解。
- **死碼清理**：移除未使用的 `ddPercent` / `streakPercent` 計算。

## [2.5.5] - 2026-02-25

### Added

- **API 錯誤提示強化**：券商同步模態框 (`SyncDateModal`) 現在會完整收集並顯示後端返回的所有錯誤訊息，不再靜默失敗。
- **同步失敗原因顯示**：交易檢核頁面的空狀態（NO DATA FOUND）現在會顯示具體錯誤原因（如「無法連接後端伺服器」），不再只顯示空白。

### Changed

- **期貨損益顯示直覺化**：同步預覽畫面中的期貨損益，全面改為直接顯示「實際獲利金額」，移除容易造成混淆的「點數」換算邏輯。
- **重複交易偵測更精準**：重構 `duplicateDetection` 邏輯，放寬手續費容錯區間至 ±2 元，且針對零數量/零價格交易進行嚴格比對，與同步核心邏輯完全對齊，大幅降低誤判率。

### Fixed

- **帳戶載入效能優化**：修復了每次打開「券商設定」或首頁時都會強制讀取憑證與完整損益的效能缺陷。現在改為輕量化設計 (`profile_only`)，僅需幾毫秒即可載入帳號清單。
- **憑證安全機制**：修補了後端核心模組中暫存憑證檔案 (`.pfx`) 可能因報錯而未被刪除的安全漏洞，導入嚴格的 `try...finally` 清理機制。
- **程式碼健壯性**：移除了後端損益模組的殘留廢棄程式碼，並修復了 CA 憑證路徑解析的反斜線錯誤。
- **Session 管理穩定性**：Thread-safe singleton 避免 race condition、Login 超時後主動清理殭屍連線、Health check 加 5 秒 timeout 防止 deadlock。
- **`profile_only` CA 不阻斷**：帳號列表模式下 CA 啟動失敗不再阻斷流程，用戶仍可正常瀏覽帳號清單。
- **前端 Fetch Timeout**：`fetchBrokerProfile` 每次 retry 加 45 秒 timeout、`verifyBrokerAccount` 加 30 秒 timeout，避免永久 pending。
- **計時器洩漏修復**：修復 `BrokerSettings` 元件卸載後 `setInterval` 計時器未清理導致的記憶體洩漏。
- **setState Race Condition**：合併連續兩次 `setState` 為一次 atomic update，修復 CA 路徑清除時的競態條件。
- **Flask Debug 安全**：`debug=True` 改為環境變數控制，避免 production 暴露 Werkzeug debugger。

## [2.4.12] - 2026-02-24

### Changed

- **UI/UX 滾動條重構**：全面將系統預設醜陋的灰色捲動條替換為纖細、帶有深色軌道與低調金銅色點綴的 `.custom-scrollbar`，符合 `@ui_ux_pro_max` 奢華暗色系主題。
- **券商設定模態框 (Stepper) 完美對齊**：放棄不穩定的絕對百分比定位，改採 `flex-1` 與 `shrink-0` 彈性排版重新建構「新增券商帳號」的進度條。徹底解決任何螢幕寬度下的線條跑出邊界與不對齊問題。
- **UI 錯誤修正**：移除了券商連線進度中殘留的幽靈背景數字「3」，完美符合當前雙步驟的設計。

## [2.4.2] - 2026-02-12

- **本地完整股票清單**：建立了包含 2,421 檔台股（上市、上櫃、興櫃與 ETF）的本地對照表，顯著提升查找速度至毫秒級。
- **雙向股票查找功能**：支援「代碼查名稱」與「名稱查代碼」雙向自動補全，並優化了相似名稱的模糊匹配優先級。
- **一鍵自動化更新**：建立 `scripts/update_stocks.bat` 供本地一鍵更新，並配置 GitHub Actions 每月自動從 TWSE 抓取最新清單並提交更新。
- **智能爬蟲過濾**：開發 Python 爬蟲腳本，精準過濾掉權證與衍生商品，保留乾淨的交易商品清單。

## [2.4.0] - 2026-02-11

### Added

- **複委託帳戶處理**：正式區分並標註複委託帳號為「券商尚未支援」，並點對點隱藏不支援的驗證按鈕。
- **一鍵憑證上傳流**：支援直接在設定頁上傳 `.pfx` 憑證內容，並在上傳成功後自動觸發重新驗證，優化「修復 -> 驗證」的閉環體驗。
- **驗證狀態視覺化**：將驗證狀態標籤移至帳號標題右側，提供更清晰的視覺層次。
- **夏普比率實作**：正式導入夏普比率 (Sharpe Ratio) 計算邏輯，基於日化報酬率與年化標準差 ($\sqrt{252}$)，提供精確的風險調整後報酬指標。
- **期望值 (Expectancy) 指標**：新增「期望值」卡片，顯示每筆交易的平均預期獲利，彌補高勝率但低賺賠比策略的盲點，協助量化策略真實優勢。

### Fixed

- **驗證流程穩定性**：
  - 移除了導致崩潰的錯誤 API 呼叫 (`set_account`)。
  - 補足了 `pnl.py` 中缺失的 `shioaji` 套件引用。
  - 修正了存取 `Order` 物件屬性時的 `AttributeError`。
- **UI 互動修復**：解決了檔案上傳元件在選擇相同檔案時不會觸發 Change 事件的問題。
- **版本標記**：全面更新設定資訊看板的版本資訊為 `V2.4.0`。

## [1.1.0] - 2026-01-25

### Added

- **永豐金原生串接 (Shioaji API)**：正式支援永豐金證券自動同步損益資料。
- **雲端佈署支援 (Cloud Ready)**：
  - 新增 `gunicorn` 生產級伺服器配置。
  - 支援 `render.yaml` 與 `Dockerfile` 一鍵佈署至雲端平台。
  - 前端支援動態切換後端網址（透過 `VITE_API_URL`）。
- **個股名稱自動對應**：匯入時自動抓取股票中文名稱，提升對帳體驗。
- **分公司精準匹配**：完整的分公司代碼地圖，支援嚴格的大小寫區分。

### Fixed

- **帳戶選擇優化**：自動識別並優先使用「證券」類型的帳戶，解決多帳號混淆問題。
- **連接穩定性**：修復了 Shioaji SDK 核心登入方法報錯。
- **資料完整性**：解決了損益明細 (Details) 遺失導致前端無法顯示的問題。
- **後端自動重啟**：`start.bat` 加入異常偵測與自動重啟機制。

### Added

- **UI/UX 強化**：全新的儀表板設計，包含情緒顏色漸層背景 (Mood Gradient)。
- **隱私模式 (Hide Amounts)**：支援全文模糊效果 (Blur)，保護敏感交易金額，適用於主畫面、分享卡片與圖表提示框。
- **圖表動畫**：切換「純損益」與「淨值」視圖時新增平滑動態過渡。
- **日期顯示優化**：全域日期格式統一為 `YYYY/MM/DD`，包含年份顯示。
- **分享功能**：完整的交易結果分享卡片，支援自定義顯示模式與圖片下載。
- **風險警報系統**：當回撤 (Drawdown) 或連敗 (Loss Streak) 超過閾值時，自動觸發紅色警報提醒。
- **多語系支援**：完整繁體中文 (台灣) 與英文介面切換。

### Fixed

- 修復了 App.tsx 中的變數重複宣告問題。
- 優化了 Firebase 同步邏輯，解決了潛在的衝突問題。
- 修正了圖表在極端縮放下的顯示異常。
