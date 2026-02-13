# Development History & Debugging Log

此文件彙整了開發過程中的關鍵技術決策、問題排除記錄與重構歷史。保留此記錄是為了協助未來的開發者快速了解系統演進脈絡與已知問題的解決方案。

---

## 2026-02-06: 基礎架構重構 (Refactor Phase 1)

### 目標

提升代碼的可維護性與錯誤處理能力，為長期開發打下基礎。

### 已完成項目

1.  **Logger 系統**: 創建 `src/utils/logger.ts`，統一管理日誌輸出，取代散落的 `console.log`。
2.  **錯誤處理系統**: 創建 `src/utils/errors.ts`，定義標準化的錯誤類別 (`BrokerConnectionError`, `ValidationError` 等)。
3.  **Broker Hook**: 實作 `src/features/broker/hooks/useBrokerStatus.ts`，即時監控券商連線狀態。

### 技術債與挑戰

- **型別定義分離**: 嘗試將 `types.ts` 拆分為多個模組 (`src/types/`)，但遭遇 Vite + TypeScript 的模組解析問題 (build failure)。
- **決策**: 採漸進式策略，暫時回滾型別分離，優先確保 build 通過，並在 `src/types/` 中保留實驗性代碼供後續優化。

---

## 2026-02-06: 404 錯誤排除 (API 連線)

### 問題

前端設定頁面顯示後端 API 404 錯誤。

### 原因

前端預設嘗試連接 Render 雲端後端 (`tradetrack-backend.onrender.com`)，但免費版 Render 服務會休眠，導致首次請求失敗。

### 解決方案

1.  **修改環境變數**: 在 `.env` 中註解掉 `VITE_API_URL`，強制前端連接本地後端 (`localhost:5000`)。
2.  **啟動本地相關**: 確保同時運行 `npm run dev` (前端) 與 `python backend/app.py` (後端)。

### 配置參考

- **本地開發**: `# VITE_API_URL=...` (預設 localhost)
- **雲端部署**: `VITE_API_URL=https://tradetrack-backend.onrender.com`

---

## 2026-02-06: Loading "轉圈圈" 問題排除

### 問題

Shioaji API 登入或資料擷取時，前端長時間顯示 Loading 動畫無回應。

### 原因分析

1.  **後端處理逾時**: Shioaji 登入與資料下載 (特別是長日期範圍) 可能耗時 30-90 秒，超過前端預設的 timeout。
2.  **網路延遲**: 雲端環境或網路不穩導致。

### 解決方案

1.  **增加前端 Timeout**: 在 `src/services/brokerService.ts` 中將 fetch timeout 延長至 **120秒**。
    ```typescript
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 120000);
    ```
2.  **優化 UI 提示**: 在 `SyncDateModal.tsx` 增加文字提示 "首次登入可能需要 1-2 分鐘"，降低使用者焦慮。

### 建議的長期優化

- 實作 WebSocket 推送後端即時進度。
- 採用分段載入 (Pagination) 機制處理大數據量。

---

## 2026-02-06: 導入 Shioaji Broker Skill

### 目的

整合永豐金證券 (Shioaji) API，實現自動化下單與行情抓取。

### 成果

建立 `.agent/skills/shioaji_broker/` 目錄，包含：

- `SKILL.md`: 完整的 API 整合文件。
- `examples/`: 登入與行情訂閱的 Python 範例腳本。
