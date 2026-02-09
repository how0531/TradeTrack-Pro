# 🔧 解決 404 錯誤 - 快速指南

## ✅ 問題已解決

**時間**: 2026-02-06 09:41 AM  
**問題**: 匯入設定頁面顯示後端錯誤 (404)  
**原因**: 前端嘗試連接 Render 雲端後端，但該服務未啟動

---

## 🛠️ 已執行的修復

### 1. 修改環境變數

**檔案**: `.env`

**變更**:

```diff
- VITE_API_URL=https://tradetrack-backend.onrender.com
+ # VITE_API_URL=https://tradetrack-backend.onrender.com
```

**效果**: 前端現在將連接到本地後端 (`localhost:5000`)

### 2. 啟動本地後端

**命令**: `python backend/app.py`

**狀態**: ✅ 正常運行

- 伺服器: http://0.0.0.0:5000
- Debugger: 已啟用
- Debugger PIN: 102-057-248

---

## 📋 下一步操作

### 重新啟動前端

由於環境變數已更改，您需要重新啟動 Vite 開發伺服器：

```bash
# 1. 停止當前的 dev server (Ctrl+C)

# 2. 重新啟動
npm run dev
```

### 測試連接

1. 重新整理瀏覽器頁面
2. 再次嘗試匯入設定
3. 404 錯誤應該已經消失

---

## 🔄 切換模式指南

### 本地開發模式 (當前)

`.env` 配置:

```bash
# VITE_API_URL=https://tradetrack-backend.onrender.com
```

**使用場景**:

- 本地開發和測試
- 需要 debug 後端程式碼
- 快速迭代

**啟動步驟**:

```bash
# Terminal 1: 啟動後端
cd backend
python app.py

# Terminal 2: 啟動前端
npm run dev
```

### 雲端部署模式

`.env` 配置:

```bash
VITE_API_URL=https://tradetrack-backend.onrender.com
```

**使用場景**:

- 產品部署
- 多人協作測試
- 不需要本地後端

**注意事項**:

- Render 免費方案會在無活動後休眠
- 首次請求可能需要 30-60 秒喚醒
- 建議使用 `wakeUpBackend()` 功能

---

## 🐛 常見問題排除

### Q1: 重新啟動前端後仍然 404

**解決方案**:

1. 確認後端正在運行: `http://localhost:5000/health`
2. 清除瀏覽器快取
3. 檢查 vite.config.ts 中的 proxy 設定

### Q2: 後端啟動失敗

**可能原因**:

- Port 5000 被占用
- Python 依賴未安裝

**解決方案**:

```bash
# 安裝依賴
cd backend
pip install -r requirements.txt

# 使用不同 port
# 修改 app.py 中的 port 參數
```

### Q3: 雲端後端一直 404

**解決方案**:

1. 確認 Render 服務已部署
2. 檢查 Render Dashboard 中的服務狀態
3. 使用正確的 URL (可能不是 tradetrack-backend.onrender.com)

---

## ✨ 額外建議

### 使用重構後的錯誤處理

現在您有了新的錯誤處理系統，可以提供更友善的提示：

```typescript
import {
  BrokerConnectionError,
  getUserFriendlyErrorMessage,
} from "@/utils/errors";

// 在 API 呼叫中
try {
  const response = await fetch(url);
  if (response.status === 404) {
    throw new BrokerConnectionError("後端 API 不可用", "API_UNAVAILABLE");
  }
} catch (error) {
  const message = getUserFriendlyErrorMessage(error, "zh");
  // 顯示友善的錯誤訊息給用戶
}
```

---

**狀態**: ✅ 問題已解決  
**下次遇到**: 參考本指南
