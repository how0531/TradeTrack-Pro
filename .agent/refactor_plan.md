# 🏗️ TradeTrack Pro 重構計劃

## 目標

在不影響現有功能的前提下，優化專案架構、開發體驗和程式碼品質。

## 執行原則

1. ✅ **向後相容**：確保所有現有功能正常運作
2. ✅ **漸進式重構**：每次只改一小部分，立即驗證
3. ✅ **Build 優先**：每個階段完成後都要確保 `npm run build` 成功

---

## Phase 1: P0 - 基礎架構重整 ⚡

### 1.1 Logger 系統統一

- [ ] 創建 `src/utils/logger.ts`
- [ ] 替換所有 `console.log` 為統一 logger
- [ ] 配置生產環境自動關閉 debug log

### 1.2 型別定義分離

- [ ] 創建 `src/types/` 目錄結構
- [ ] 拆分 `types.ts` 為獨立模組
- [ ] 更新所有 import 路徑

### 1.3 Broker Feature 建立

- [ ] 創建 `src/features/broker/` 結構
- [ ] 移動 `brokerService.ts` → `features/broker/services/`
- [ ] 移動 `BrokerSettings.tsx` → `features/broker/components/`
- [ ] 更新所有引用路徑

---

## Phase 2: P1 - 程式碼品質提升 🛡️

### 2.1 錯誤處理強化

- [ ] 創建 `src/utils/errors.ts`
- [ ] 定義自訂錯誤類別
- [ ] 更新 broker 相關錯誤處理

### 2.2 後端 Session 管理優化

- [ ] 在 `session.py` 加入過期檢查
- [ ] 加入 rate limiting 防護

### 2.3 後端 API 模組化

- [ ] 創建 `backend/api/broker.py`
- [ ] 從 `app.py` 提取券商路由
- [ ] 使用 Flask Blueprint

---

## Phase 3: P2 - 進階優化 🚀

### 3.1 API 驗證層

- [ ] 安裝 `zod` 或 `pydantic`
- [ ] 建立 schema 驗證

### 3.2 測試覆蓋

- [ ] 建立測試框架
- [ ] 為核心邏輯加入單元測試

### 3.3 文檔完善

- [ ] 建立 API 文檔
- [ ] 更新架構說明

---

## 驗證清單

每個 Phase 完成後需確認：

- [ ] `npm run build` 成功（Exit Code 0）
- [ ] 開發環境正常啟動 (`npm run dev`)
- [ ] 瀏覽器 Console 無紅字錯誤
- [ ] 券商登入功能正常
- [ ] PnL 同步功能正常

---

## 回滾策略

如果任何階段出現問題：

1. 立即使用 `git checkout` 回滾
2. 記錄問題並調整計劃
3. 重新執行該階段
