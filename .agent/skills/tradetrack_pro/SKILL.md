---
name: TradeTrack-Pro
description: Complete architecture and feature reference for the TradeTrack-Pro trading journal application. Use this skill when modifying any part of the project.
---

# TradeTrack-Pro — 完整專案技能文件

> **版本**: v2.5.3  
> **技術棧**: React 18 + Vite 5 + TailwindCSS 3 (Frontend) / Flask + Shioaji (Backend)  
> **部署**: Zeabur (Frontend) / Render (Backend)

---

## 1. 專案概覽

TradeTrack-Pro 是一個台灣期貨/股票交易日記應用程式，支援：

- 手動記錄交易 + Shioaji 券商自動匯入
- 權益曲線、績效指標、策略分析
- Firebase 雲端同步 + IndexedDB 本地儲存
- 多帳戶管理（台股現貨/期貨）

### 目錄結構

```
TradeTrack-Pro/
├── src/                    # React 前端
│   ├── App.tsx             # 主應用 (路由 + 全域狀態)
│   ├── pages/              # 4 個頁面
│   ├── features/           # 7 個功能模組
│   ├── components/         # 共用元件 (Layout, Modals, Selectors)
│   ├── hooks/              # 8 個 Custom Hooks
│   ├── services/           # brokerService.ts, stockService.ts
│   ├── utils/              # 計算、格式化、股票名稱等工具
│   ├── types/              # TypeScript 型別定義
│   ├── context/            # TradeContext, AuthContext
│   ├── db/                 # Dexie (IndexedDB) 資料庫定義
│   └── locales/            # i18n 多語系
├── backend/                # Python Flask 後端
│   ├── app.py              # Flask 主應用 + API 路由
│   └── core/               # 核心邏輯
│       ├── pnl.py          # Shioaji PnL 查詢引擎
│       ├── session.py      # Shioaji 連線管理器
│       ├── stock_info.py   # 股票名稱查詢
│       └── constants.py    # 分公司代碼對照表
└── .agent/skills/          # AI Skills
```

---

## 2. 前端架構

### 2.1 頁面 (`src/pages/`)

| 頁面     | 檔案               | 說明                               |
| -------- | ------------------ | ---------------------------------- |
| 儀表板   | `JournalPage.tsx`  | 權益曲線 + 績效指標卡片 + 交易日記 |
| 交易紀錄 | `LogsPage.tsx`     | 交易明細列表 (可編輯/刪除)         |
| 統計分析 | `StatsPage.tsx`    | 策略分析 + 月度統計 + 勝率         |
| 設定     | `SettingsPage.tsx` | 帳戶/券商/外觀設定                 |

### 2.2 功能模組 (`src/features/`)

| 模組         | 說明                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `dashboard/` | `EquityCurve.tsx` 權益曲線圖 + `MetricsCards.tsx` 績效卡片            |
| `history/`   | `LogsView.tsx` 交易明細 + `CalendarView.tsx` 月曆檢視                 |
| `analytics/` | `StrategyBreakdown.tsx` 策略拆解 + `StrategyDetailModal.tsx`          |
| `trade/`     | `TradeModal.tsx` 新增/編輯交易的彈窗                                  |
| `broker/`    | `BrokerSyncModal.tsx` 券商資料同步流程                                |
| `settings/`  | `AccountSettings.tsx` + `AppearanceSettings.tsx` + `DataSettings.tsx` |
| `calendar/`  | `CalendarHeatmap.tsx` 熱力圖 + `MonthlyCalendar.tsx`                  |

### 2.3 核心元件 (`src/components/`)

| 元件                       | 說明                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| `Layout.tsx`               | 主佈局 (含側邊欄/底部導航)                                                   |
| `NavigationBar.tsx`        | 導航列                                                                       |
| `SyncIndicator.tsx`        | Firebase 同步狀態指示器                                                      |
| **Modals/**                |                                                                              |
| `SyncDateModal.tsx`        | 券商同步主彈窗 (**80KB，最大元件**) — 帳號選擇、日期選擇、交易預覽、衝突解決 |
| `CustomDateRangeModal.tsx` | 自訂日期範圍選擇器 (支援手動輸入)                                            |
| `ImportConflictModal.tsx`  | 匯入衝突處理                                                                 |
| `SyncConflictModal.tsx`    | Firebase 同步衝突                                                            |
| `ShareCardModal.tsx`       | 分享交易成績卡片 (html2canvas)                                               |
| **Selectors/**             |                                                                              |
| `FrequencySelector.tsx`    | 日/週/月 頻率切換                                                            |
| `TimeRangeSelector.tsx`    | 時間範圍快選 (1M/3M/6M/1Y/ALL)                                               |
| `PortfolioSelector.tsx`    | 帳戶組合選擇                                                                 |
| `MultiSelectDropdown.tsx`  | 通用多選下拉                                                                 |

### 2.4 Custom Hooks (`src/hooks/`)

| Hook               | 說明                                                                             |
| ------------------ | -------------------------------------------------------------------------------- |
| `useIndexedDBData` | **核心資料層** — Dexie IndexedDB CRUD (trades, portfolios, strategies, emotions) |
| `useSync`          | Firebase Firestore 雲端雙向同步                                                  |
| `useMetrics`       | 計算績效指標 (權益曲線、勝率、MDD、Sharpe 等)                                    |
| `useAuth`          | Firebase Authentication                                                          |
| `useLocalStorage`  | localStorage 偏好設定                                                            |
| `useCountUp`       | 數字動畫                                                                         |
| `useClickOutside`  | 點擊外部關閉                                                                     |
| `useLocalData`     | Legacy localStorage 資料層 (已遷移至 IndexedDB)                                  |

### 2.5 服務層 (`src/services/`)

| 服務               | 說明                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `brokerService.ts` | 與 Flask 後端通訊：`fetchBrokerProfile()`, `fetchBrokerPnl()`, `validateBackendStatus()`, `wakeUpBackend()`, `verifyBrokerAccount()` |
| `stockService.ts`  | 股票名稱三層查詢：LocalMap → Cache → TWSE/Backend                                                                                    |

### 2.6 工具函式 (`src/utils/`)

| 工具                    | 說明                                                     |
| ----------------------- | -------------------------------------------------------- |
| `calculations.ts`       | `calculateMetrics()` 核心績效計算 + `calculateStreaks()` |
| `format.ts`             | 日期/金額/百分比格式化                                   |
| `stockMap.ts`           | 本地股票代碼→名稱對照表 (57KB)                           |
| `symbolNames.ts`        | 期貨代碼解析 (TXF→台指期, MTX→小台指 等)                 |
| `duplicateDetection.ts` | 券商匯入去重邏輯                                         |
| `cache.ts`              | 通用快取工具                                             |
| `errors.ts`             | 錯誤處理 + 使用者友善訊息                                |
| `migration.ts`          | localStorage → IndexedDB 遷移                            |
| `logger.ts`             | 結構化日誌                                               |

### 2.7 核心型別 (`src/types/`)

#### Trade（交易記錄）

```typescript
interface Trade {
  id: string; // 唯一 ID (trade-{timestamp})
  date: string; // YYYY-MM-DD
  pnl: number; // 損益金額 (NTD)
  strategy?: string; // 策略標籤
  emotion?: string; // 情緒/風格標籤
  note?: string; // 交易筆記
  image?: string; // 截圖 (base64)
  portfolioId?: string; // 所屬帳戶
  orderNo?: string; // 委託單號 (券商同步)
  code?: string; // 商品代碼 (如 "2330 台積電")
  entryPrice?: number; // 進場價
  exitPrice?: number; // 出場價
  quantity?: number; // 數量 (張/口)
  category?: string; // 類別 (台股/期貨/複委託)
  raw_yield?: number; // 原始報酬率
  yield?: number; // 報酬率 (%)
  points?: string; // 獲利點數 (如 "+150 pts")
}
```

#### BrokerConfig（券商設定）

```typescript
interface BrokerConfig {
  id: string;
  provider: "mock" | "shioaji";
  apiKey: string;
  apiSecret: string;
  personId: string;
  caPath: string;
  caPassword: string;
  caContent?: string; // Base64 .pfx 憑證
  isConnected: boolean;
  branchCode?: string; // 分公司代碼
  accountType?: "S" | "F"; // 帳號類型篩選
  environment?: "production" | "simulation";
}
```

### 2.8 資料儲存

| 層   | 技術                   | 用途                                     |
| ---- | ---------------------- | ---------------------------------------- |
| 主要 | **Dexie (IndexedDB)**  | trades, portfolios, strategies, emotions |
| 偏好 | **localStorage**       | UI 設定、帳戶選擇、損失顏色              |
| 雲端 | **Firebase Firestore** | 跨裝置同步 (可選)                        |

---

## 3. 後端架構

### 3.1 Flask API 路由 (`backend/app.py`)

| 路由                     | 方法 | 說明                  |
| ------------------------ | ---- | --------------------- |
| `/`                      | GET  | 伺服器狀態 + 版本資訊 |
| `/health`                | GET  | 健康檢查              |
| `/api/broker/profile`    | POST | 登入 + 取得帳號列表   |
| `/api/broker/pnl`        | POST | 查詢損益資料          |
| `/api/broker/verify`     | POST | 模擬下單開通 API      |
| `/api/stock/info/<code>` | GET  | 查詢股票名稱          |

### 3.2 核心模組

#### `core/session.py` — Shioaji 連線管理

```python
class ShioajiSessionManager:
    """
    全域單例，管理 Shioaji API 連線生命週期。
    - 相同憑證自動重用連線 (Session Reuse)
    - 憑證變更時安全斷開再重連
    - CA 憑證啟動 + 有效期管理 (_CA_EXPIRY_SECONDS = 1800)
    """
    def get_api(api_key, secret_key, person_id, ca_path, ca_password, simulation)
    def ensure_ca_active(ca_path, ca_password, person_id)
```

> **⚠️ 已知問題**: `_CA_EXPIRY_SECONDS` 設為 `0` 時，每次查詢都會重新 activate_ca，導致 Shioaji 狀態異常、第二次查詢回傳空值。目前已設為 `1800` (30分鐘)。

#### `core/pnl.py` — PnL 查詢引擎

核心函式: `login_and_fetch_pnl()`

**完整流程**:

1. 透過 `SessionManager.get_api()` 取得/重用 API 連線
2. 確認 CA 憑證已啟動 (`ensure_ca_active`)
3. 列出所有帳號 (`api.list_accounts()`)
4. 根據 `branch_filter` / `type_filter` 篩選帳號
5. 對每個帳號呼叫 `api.list_profit_loss(account, start_date, end_date)`
6. 解析回傳物件並映射至前端格式

**資料映射**（根據 [Shioaji 官方文件](https://sinotrade.github.io/tutor/accounting/profit_loss/)）:

##### StockProfitLoss（台股現貨）

```
API 屬性           →  前端欄位
──────────────────────────────
code               →  code (display_code)
quantity           →  quantity (已是張，不需 ÷ 1000)
price              →  price
pnl                →  pnl (NTD)
pr_ratio × 100     →  yield (%)
cond               →  category (Cash/MarginTrading/ShortSelling/Netting)
date               →  date
seqno / dseq       →  orderNo
```

##### FutureProfitLoss（期貨/選擇權）

```
API 屬性           →  前端欄位
──────────────────────────────
code               →  code (display_code)
quantity           →  quantity (口數)
entry_price        →  entryPrice, price
cover_price        →  exitPrice
pnl                →  pnl (NTD)
(自行計算)          →  yield (%)
direction          →  (未使用)
tax, fee           →  (未使用)
date               →  date
```

> **⚠️ 重要**: `list_profit_loss` 的 `unit` 參數預設為 `Unit.Common`，台股 quantity 已是「張」。`pr_ratio` 是小數 (如 0.1237 = 12.37%)，需 `× 100`。

#### `core/stock_info.py` — 股票名稱查詢

從 TWSE ISIN API 查詢股票名稱作為後端 fallback。

---

## 4. 資料流

### 4.1 券商同步流程

```
[前端 SyncDateModal]
    ↓ fetchBrokerProfile(config)
    ↓ POST /api/broker/profile
[後端 login_and_fetch_pnl (profile_only=true)]
    ↓ Shioaji login → list_accounts
    ↓ 回傳帳號列表
[前端顯示帳號選擇]
    ↓ 使用者選擇帳號 + 日期範圍
    ↓ fetchBrokerPnl(startDate, endDate, config)
    ↓ POST /api/broker/pnl
[後端 login_and_fetch_pnl]
    ↓ Session Reuse → ensure_ca_active
    ↓ list_profit_loss(account, start, end)
    ↓ 映射 StockProfitLoss / FutureProfitLoss → JSON
[前端接收 details[]]
    ↓ 去重 (duplicateDetection.ts)
    ↓ 轉換為 Trade[] (SyncDateModal 內部)
    ↓ bulkPut 寫入 IndexedDB
    ↓ Firebase 同步 (if connected)
```

### 4.2 績效計算流程

```
[useIndexedDBData] → trades[]
    ↓
[useMetrics] → calculateMetrics()
    ↓ 篩選日期範圍 + 帳戶
    ↓ 計算權益曲線、MDD、勝率、Sharpe、PF
    ↓
[Dashboard / StatsPage] → 渲染圖表 + 卡片
```

---

## 5. 部署架構

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Zeabur     │     │   Render     │     │  Shioaji    │
│  (Frontend)  │────▶│  (Backend)   │────▶│  API        │
│  Vite Build  │     │  Flask+Gunicorn│    │  永豐金     │
└──────┬──────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  Firebase    │
│  Auth + DB   │
└─────────────┘
```

### 環境變數

| 變數            | 位置            | 說明                     |
| --------------- | --------------- | ------------------------ |
| `VITE_API_URL`  | Frontend (.env) | 後端完整 URL             |
| `VITE_API_HOST` | Frontend (.env) | 後端 hostname (Render)   |
| `PORT`          | Backend         | Flask 監聽埠 (預設 5000) |

### 本地開發

```bash
# 前端
npm run dev          # → http://localhost:5173

# 後端
cd backend && python app.py  # → http://localhost:5000
```

---

## 6. Shioaji API 速率限制

| 類別     | 限制                                                 |
| -------- | ---------------------------------------------------- |
| 帳務查詢 | 5 秒 25 次 (`list_profit_loss`, `list_positions` 等) |
| 登入     | 每日 1000 次                                         |
| 連線數   | 同一 person_id 最多 5 連線                           |
| 流量     | 近 30 日無成交: 500MB/日                             |

---

## 7. 常見問題與陷阱

### 7.1 台股 quantity 單位

- `Unit.Common`（預設）: quantity = **張** (不需 ÷ 1000)
- `Unit.Share`: quantity = **股**
- 我們使用預設，所以 **直接用 quantity**

### 7.2 pr_ratio 是小數

- API 回傳 `0.1237` 表示 12.37%
- 前端需要 `pr_ratio × 100`

### 7.3 期貨屬性名

- 是 `entry_price` / `cover_price`，**不是** `buy_price` / `sell_price`
- `buy_price`/`sell_price` 出現在 `list_profit_loss_summary`（不同 API）

### 7.4 CA 憑證生命週期

- `_CA_EXPIRY_SECONDS = 1800` (30分鐘)
- 設為 `0` 會導致每次查詢重新 activate_ca → 第二次查詢空值
- 雲端部署需用 Base64 `caContent` 上傳，不能用本地路徑

### 7.5 Flask Hot Reload

- `app.py` 啟動時 `debug=True`，修改 `pnl.py` 等模組會自動重載
- 但 `session.py` 的全域 `_SESSION_MANAGER` 會因重載而重置

### 7.6 IndexedDB 遷移

- v2.3 之前使用 localStorage，之後遷移至 Dexie IndexedDB
- `useIndexedDBData` 會自動偵測並執行一次性遷移
