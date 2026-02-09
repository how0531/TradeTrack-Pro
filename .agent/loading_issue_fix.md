# 🔄 "一直轉圈圈" 問題診斷與解決

**問題時間**: 2026-02-06 12:21 PM  
**症狀**: 前端頁面loading一直轉圈圈，沒有回應

---

## 🔍 最可能的原因

### 1. 後端處理時間過長 (90%機率)

Shioaji API 登入和資料擷取需要時間：

- 📝 驗證登入憑證：10-30秒
- 📥 下載交易資料：依日期範圍而定（可能 30秒 - 2分鐘）
- 🌐 網路連線速度影響

**問題**: 前端可能沒有設定足夠的超時時間

### 2. 後端發生錯誤但沒有正確回應 (8%機率)

### 3. 前端請求參數不正確 (2%機率)

---

## 🛠️ 立即解決方案

### 方案 A：增加前端超時時間（推薦）

修改 `src/services/brokerService.ts`，增加請求超時時間：

```typescript
// 在 fetchBrokerPnl 函數中
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超時

try {
  const response = await fetch(`${API_BASE}/api/broker/pnl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal, // 添加超時控制
  });

  clearTimeout(timeoutId);
  // ... rest of code
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === "AbortError") {
    throw new Error("請求超時，請稍後再試");
  }
  throw error;
}
```

### 方案 B：添加進度提示

在 UI 中顯示更清楚的狀態訊息：

```typescript
// 在 SyncDateModal.tsx 中
<div className="loading-container">
    {isLoading && (
        <>
            <Spinner />
            <p>正在連接券商API...</p>
            <p className="text-sm text-gray-500">
                首次登入可能需要 1-2 分鐘，請耐心等候
            </p>
        </>
    )}
</div>
```

### 方案 C：檢查後端日誌

查看後端到底在處理什麼：

```bash
# 查看正在運行的 Flask 日誌
# 應該會看到登入進度訊息
```

---

## 🔎 快速診斷步驟

### Step 1: 檢查瀏覽器開發者工具

1. 按 F12 打開開發者工具
2. 切換到 **Network** 標籤
3. 過濾: `broker`
4. 查看請求狀態：
   - ⏳ **Pending**: 正在等待後端回應（正常，但時間過長）
   - ❌ **Failed**: 網路錯誤
   - ✅ **200**: 成功

### Step 2: 查看請求詳情

在 Network 中點擊請求，查看：

- **Request Payload**: 確認發送的參數是否完整
- **Response**: 是否有錯誤訊息

### Step 3: 查看Console

開發者工具的 **Console** 標籤中：

- 查找紅色錯誤訊息
- 查找 `[PERF]` 開頭的日誌（顯示處理時間）

---

## 💊 臨時解決方法（測試用）

如果急需測試其他功能，可以：

### 1. 使用 Mock 模式

```typescript
// 在 BrokerSettings.tsx 中
const testConfig: BrokerConfig = {
  id: "test",
  provider: "mock", // 使用 mock 模式
  isConnected: true,
  // ... 其他配置
};
```

### 2. 縮短日期範圍

減少要擷取的資料量：

- 原本: 2026-01-08 到 2026-02-06 (30天)
- 改為: 最近 7 天

---

## 📊 預期的正常行為

### 正常登入流程時間參考

| 步驟             | 預期時間    |
| ---------------- | ----------- |
| 驗證憑證         | 10-15秒     |
| 登入 Shioaji     | 15-30秒     |
| 擷取資料（每日） | 1-2秒/日    |
| **總計（30天）** | **45-90秒** |

### 如果超過 2 分鐘

可能原因：

1. 網路連線問題
2. Shioaji 伺服器回應慢
3. 憑證驗證失敗但未正確報錯

---

## 🚨 錯誤排除

### 如果持續轉圈圈超過 3 分鐘

1. **取消請求**
   - 重新整理頁面
   - 或關閉 Modal

2. **檢查後端日誌**

   ```bash
   # 後端應該在 terminal 中顯示處理進度
   # 如果沒有任何輸出，表示請求根本沒到後端
   ```

3. **重新啟動後端**

   ```bash
   # Ctrl+C 停止
   cd backend && python app.py
   ```

4. **清除瀏覽器快取**
   - Ctrl+Shift+Delete
   - 清除快取和 Cookies

---

## ✅ 建議的改進（下一階段）

1. **添加 WebSocket** - 實時顯示後端處理進度
2. **分段載入** - 將大日期範圍分成小段
3. **背景處理** - 使用 Service Worker
4. **重試機制** - 自動重試失敗的請求

---

## 📝 下一步行動

請按照以下順序操作：

1. ✅ 打開瀏覽器開發者工具（F12）
2. ✅ 切換到 Network 標籤
3. ✅ 重新嘗試操作
4. ✅ 觀察請求狀態
5. ✅ 回報您看到的狀態

然後我可以提供更精確的解決方案！

---

**更新時間**: 2026-02-06 12:30 PM
