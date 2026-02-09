# 券商匯入流程測試與問題排查指引

## 📋 完整匯入流程測試

### 前置準備

1. ✅ 券商 API Key、Secret、Person ID
2. ✅ 確認 838 筆 BRANCH_MAP 資料已載入
3. ✅ 確認前端 fallback 機制已實作

### 測試步驟

#### Step 1: 設定券商資訊

```
1. 開啟應用程式
2. 進入「設定」→「券商設定」
3. 填入以下資訊：
   - 券商名稱: 永豐金證券
   - API Key: [您的 API Key]
   - API Secret: [您的 API Secret]
   - Person ID: [您的身份證字號]
   - 分公司代碼: (選填，例如：9A9D)
   - 模擬模式: ✓ (測試時建議勾選)
4. 點擊「儲存」
5. 確認綠色成功訊息出現
```

**預期結果**: ✅ 設定成功儲存到 LocalStorage

#### Step 2: 開啟匯入功能

```
1. 點擊「匯入交易」按鈕
2. 確認彈出視窗正常顯示
3. 確認可以選擇日期範圍
```

**預期結果**: ✅ SyncDateModal 正常開啟

#### Step 3: 查詢券商資料

```
1. 選擇日期範圍（例如：最近 7 天）
2. 點擊「查詢」按鈕
3. 觀察載入狀態
```

**預期結果**:

- ✅ 顯示載入中 (Loading spinner)
- ✅ 後端日誌顯示登入過程
- ✅ 無錯誤訊息

#### Step 4: 檢查帳戶選擇

```
如果有多個帳戶：
1. 確認顯示分公司名稱（例如：永豐金-忠孝 (Stock)）
2. 確認可以選擇帳戶
3. 點擊「確認」

如果只有單一帳戶：
1. 自動進入下一步
```

**預期結果**: ✅ 分公司名稱正確顯示（使用 BRANCH_MAP）

#### Step 5: 檢查交易明細

```
1. 確認交易清單正常顯示
2. 檢查以下欄位：
   - 日期格式: YYYY/MM/DD
   - 標的名稱:
     ✓ 股票應顯示中文（例如：台積電）
     ✓ 期貨應顯示中文（例如：台指期）
   - 買賣別: 買/賣
   - 數量: 正常數字
   - 價格: 正常數字
   - 損益: 正常數字（可能為負）
3. 勾選要匯入的交易
```

**預期結果**:

- ✅ 標的名稱顯示中文
- ✅ 資料完整無遺漏

#### Step 6: 執行匯入

```
1. 選擇目標投資組合
2. 點擊「匯入選定的交易」
3. 等待完成訊息
```

**預期結果**:

- ✅ 匯入成功訊息
- ✅ 交易出現在主畫面

### 測試 Checklist

- [ ] 券商設定可正常儲存
- [ ] 登入流程正常（無錯誤）
- [ ] 分公司名稱正確顯示
- [ ] 股票標的顯示中文名稱
- [ ] 期貨標的顯示中文名稱
- [ ] 損益資料正確
- [ ] 可成功匯入到資料庫
- [ ] 匯入後資料在主畫面正常顯示

---

## 🔍 Troubleshooting 指引

### 問題 1: 登入失敗

**症狀**:

```
錯誤訊息：「登入失敗，請檢查 API Key 及 Secret」
```

**可能原因**:

1. API Key 或 Secret 輸入錯誤
2. Person ID 格式不正確
3. API 權限未開啟
4. 網路連線問題

**解決方案**:

```bash
# 1. 檢查後端日誌
tail -f backend/logs/pnl.log

# 2. 確認輸入的資訊是否有多餘空格
# 3. 到券商網站確認 API Key 狀態
# 4. 嘗試使用模擬模式測試
```

### 問題 2: 分公司名稱顯示「未知分公司[XXXX]」

**症狀**:

```
帳戶選擇畫面顯示：未知分公司[1234] (Stock)
```

**可能原因**:

- 該分公司代碼不在 BRANCH_MAP 中（838 筆資料可能未涵蓋所有）

**解決方案**:

```python
# 1. 查看後端日誌，找到警告訊息
⚠️ [BRANCH_MAP] Unknown branch code: 1234 - Please update constants.py

# 2. 手動更新 constants.py
BRANCH_MAP = {
    ...
    "1234": "券商名稱-分公司名稱",
    ...
}

# 3. 重新啟動後端
```

### 問題 3: 期貨標的只顯示代號（例如：TXFK6）

**症狀**:

```
交易清單顯示：TXFK6（應該顯示：台指期）
```

**可能原因**:

1. 後端 SDK 查詢失敗
2. 前端 fallback 也失敗

**解決方案**:

**方案 A: 檢查後端日誌**

```bash
# 查看名稱查詢日誌
grep "Name Query" backend/logs/pnl.log

# 預期看到：
🔍 [Name Query] Code: TXFK6, Type: Futures, Initial name: ''
⚠️ [Name Query] Failed for TXFK6 - Will use code only (Frontend fallback available)
```

**方案 B: 補充前端 Fallback**

```typescript
// src/utils/symbolNames.ts
export const FUTURES_NAME_MAP = {
  TXF: "台指期",
  MTX: "小台指",
  TE: "電子期",
  TF: "金融期",
  // 新增遺漏的期貨商品...
};
```

**方案 C: 檢查 SDK 版本**

```bash
# 查看 Shioaji 版本
pip show shioaji

# 如果版本過舊，升級
pip install --upgrade shioaji
```

### 問題 4: 匯入後資料不見

**症狀**:

```
匯入成功訊息出現，但主畫面沒有新交易
```

**可能原因**:

1. 目標投資組合選擇錯誤
2. 日期過濾未包含該筆交易
3. LocalStorage 儲存失敗

**解決方案**:

```javascript
// 1. 開啟瀏覽器 Console，檢查 LocalStorage
localStorage.getItem("transactions");

// 2. 確認交易是否已儲存
JSON.parse(localStorage.getItem("transactions"));

// 3. 檢查投資組合過濾
// 主畫面 → 選擇正確的投資組合
```

### 問題 5: 重複匯入相同交易

**症狀**:

```
同一筆交易被匯入多次
```

**可能原因**:

- 去重邏輯未生效

**解決方案**:

```typescript
// 檢查 brokerService.ts 的去重邏輯
// 應該根據 date + symbol + quantity + price 判斷是否重複
```

---

## 🧪 進階測試

### 壓力測試：大量交易

```
1. 選擇較長的日期範圍（例如：3 個月）
2. 確認可以正常載入
3. 確認不會記憶體溢出
```

### 邊界測試：特殊字元

```
1. 測試含有特殊字元的標的（例如：權證）
2. 確認可以正常顯示
```

### 錯誤恢復測試

```
1. 故意中斷網路連線
2. 嘗試查詢
3. 確認顯示友善的錯誤訊息
4. 恢復網路後可以重試
```

---

## 📊 後端日誌解讀

### 正常流程的日誌範例

```
📝 [PnL] Starting login...
✅ [PnL] Login successful
🔍 [PnL] Fetching accounts...
📊 [PnL] Found 2 accounts
🔍 [Name Query] Code: 2330, Type: Stock, Initial name: ''
✅ [Name Query] Success: 2330 -> 台積電
🔍 [Name Query] Code: TXFK6, Type: Futures, Initial name: ''
✅ [Name Query] Success: TXFK6 -> 台指期
📤 [PnL] Returning 15 transactions
✅ [PnL] Logout successful
```

### 錯誤情境的日誌範例

```
📝 [PnL] Starting login...
❌ [PnL] Login failed: Invalid API Key
⚠️ [BRANCH_MAP] Unknown branch code: 9999 - Please update constants.py
⚠️ [Name Query] Failed for XYZ123 - Will use code only (Frontend fallback available)
```

---

## ✅ 完整性檢查清單

### 後端

- [x] BRANCH_MAP 包含 838 筆資料
- [x] 未知分公司代碼會記錄警告
- [x] 標的名稱查詢有詳細日誌
- [x] 查詢失敗有 fallback 機制
- [x] 所有異常都有適當處理

### 前端

- [x] SettingsView 可儲存券商設定
- [x] SyncDateModal 可查詢並顯示資料
- [x] formatSymbolCode 提供 fallback
- [x] 期貨名稱對照表完整（FUTURES_NAME_MAP）

### 資料流

- [x] 前端 → 後端參數完整
- [x] 後端 → 前端格式統一
- [x] 錯誤訊息使用者友善
- [x] 日誌記錄足夠 debug

---

## 📞 取得協助

### 如果問題仍未解決

1. **收集資訊**:
   - 完整的錯誤訊息截圖
   - 後端日誌 (最近 50 行)
   - 瀏覽器 Console 錯誤
   - 重現步驟

2. **提供環境資訊**:
   - 作業系統
   - Python 版本
   - Shioaji 版本
   - 瀏覽器版本

3. **聯絡開發團隊**:
   - 描述問題時請包含上述資訊
   - 附上相關的日誌片段

---

**文檔版本**: 1.0  
**最後更新**: 2026-02-06  
**維護**: TradeTrack-Pro 開發團隊
