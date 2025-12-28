
# TradeTrack Pro - 開發者指南 (Developer Guide)

本文件旨在協助開發者快速理解專案架構、技術選型與核心邏輯，以便進行維護或功能擴充。

---

## 1. 技術堆疊 (Tech Stack)

*   **核心框架**: [React 19](https://react.dev/)
*   **語言**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode Enabled)
*   **建置工具**: [Vite](https://vitejs.dev/)
*   **樣式**: [Tailwind CSS](https://tailwindcss.com/) + Inline Styles (for dynamic themes)
*   **圖表**: [Recharts](https://recharts.org/)
*   **圖示**: [Lucide React](https://lucide.dev/)
*   **後端服務**: [Firebase](https://firebase.google.com/) (Authentication & Firestore)
*   **PWA**: [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

---

## 2. 專案結構 (Project Structure)

專案採用「功能導向 (Feature-based)」與「元件導向 (Component-based)」混合的架構。

```
src/
├── components/          # 共用 UI 元件
│   ├── form/            # 表單相關 (ChipInputs)
│   ├── modals/          # 彈出視窗 (DateRange, SyncConflict)
│   ├── selectors/       # 篩選器 (Frequency, Portfolio, TimeRange)
│   └── tabs/            # 主要頁籤容器 (StatsTab, JournalTab, LogsTab)
├── features/            # 業務邏輯模組
│   ├── analytics/       # 數據分析 (StrategyDetailModal, StrategyListView)
│   ├── calendar/        # 日曆視圖 (CalendarView)
│   ├── logs/            # 交易列表 (LogsView)
│   ├── settings/        # 設定頁面 (SettingsView)
│   └── trade/           # 交易操作 (TradeModal)
├── hooks/               # Custom Hooks
│   ├── useAuth.ts       # Firebase Auth 封裝
│   ├── useLocalStorage.ts # 本地存儲封裝
│   ├── useMetrics.ts    # 核心計算邏輯橋接
│   └── useTradeData.ts  # 資料流核心 (Sync + CRUD)
├── utils/               # 工具函式
│   ├── calculations.ts  # 複雜的金融計算 (MDD, WinRate, Equity Curve)
│   ├── format.ts        # 格式化 (Currency, Date)
│   └── storage.ts       # JSON 下載/解析
├── constants.ts         # 全域常數 (Theme, I18N, Configs)
├── types.ts             # TypeScript Type Definitions
├── firebaseConfig.ts    # Firebase 初始化設定
└── App.tsx              # 應用程式入口與路由邏輯
```

---

## 3. 核心邏輯解析

### A. 資料流架構 (Data Flow Architecture)
本專案採用 **"Offline First" (離線優先)** 架構。

1.  **Single Source of Truth**: UI 總是讀取 `useTradeData.ts` 中的 state (由 `useLocalStorage` 初始化)。這確保了即使沒有網路，應用程式也能瞬間載入。
2.  **背景同步**:
    *   當使用者進行 CRUD 操作時，先更新本地 State 與 LocalStorage。
    *   透過 `setTimeout` 非同步觸發 `triggerCloudBackup`。
    *   若使用者已登入，資料會寫入 Firestore (`users/{uid}`).
3.  **初始同步 (Hydration)**:
    *   當 `useAuth` 偵測到登入且狀態為 online 時，會監聽 Firestore 的 `onSnapshot`。
    *   若本地無資料但雲端有資料，則自動還原雲端資料。
    *   若本地有資料且與雲端不一致，則觸發 `SyncConflictModal` 供使用者選擇。

### B. 績效計算 (Metrics Calculation)
所有的數學邏輯集中於 `src/utils/calculations.ts`。

*   **calculateMetrics**: 接收交易陣列，回傳 `Metrics` 物件。
    *   **權益曲線 (Equity Curve)**: 會自動補齊無交易日的數據，確保圖表連續性。
    *   **回撤 (Drawdown)**: 計算 Peak-to-Valley 的百分比。
    *   **策略分析**: 針對每個策略標籤進行獨立的損益、勝率計算。

### C. 主題與樣式 (Theming)
*   主要色系定義在 `src/constants.ts` 的 `THEME` 物件中。
*   大量使用 **Glassmorphism (毛玻璃特效)**：
    *   `backdrop-blur-xl` + `bg-opacity`
    *   細緻的 `border-white/5` 或 `border-white/10` 營造質感。
*   **動態顏色**: 盈虧顏色 (Profit/Loss) 可由使用者在設定中自訂，透過 `Portfolio` 物件傳遞至各元件。

---

## 4. 開發注意事項

### 新增功能
1.  **Type Safety**: 請務必在 `src/types.ts` 定義新的 Interface。
2.  **I18N**: 所有文字請提取至 `src/constants.ts` 的 `I18N` 物件中，支援中英切換。
3.  **Components**: 
    *   小型 UI (如按鈕、卡片) 若僅用於單一 View，建議直接寫在該 View 檔案內 (Inline Component) 以保持高內聚。
    *   通用型 UI 才放入 `src/components/`。

### Firebase 整合
*   目前配置位於 `src/firebaseConfig.ts`。
*   若要更換專案，請更新 `firebaseConfig` 物件內的 API Key 等資訊。
*   Firestore 規則需確保使用者只能讀寫自己的文件：
    ```
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    ```

### PWA 測試
*   在開發模式 (`npm run dev`) 下，PWA 功能可能受限。
*   請使用 `npm run build` 後透過 `npm run preview` 測試 Service Worker 與安裝提示。

---

## 5. 常用指令

*   **啟動開發伺服器**: `npm run dev`
*   **建置生產版本**: `npm run build`
*   **預覽生產版本**: `npm run preview`
*   **Type Check**: `npx tsc --noEmit`

---
*TradeTrack Pro Development Team*
