# 券商匯入流程完整性檢查計畫

## 🎯 目標

確保從「設定券商資訊」→「登入」→「取得資料」→「顯示」→「匯入」的完整流程都能正確運作，並且：

- ✅ 分公司名稱正確顯示（使用 BRANCH_MAP 838 筆資料）
- ✅ 期貨標的名稱正確顯示中文
- ✅ 資料格式正確儲存

## 📋 檢查清單

### Phase 1: 券商設定儲存與讀取

**檔案**: `src/features/settings/components/SettingsView.tsx`

- [ ] **檢查項目 1.1**: 券商設定儲存格式
  - 確認儲存的欄位包含：broker_id, apiKey, apiSecret, personId, branch
  - 確認 branch 欄位正確儲存（例如：9A9D）

- [ ] **檢查項目 1.2**: 券商設定讀取
  - 確認能正確從 localStorage 讀取設定
  - 確認能正確傳遞給後端 API

### Phase 2: 後端 API 登入流程

**檔案**: `backend/core/pnl.py` (line 40-135)

- [ ] **檢查項目 2.1**: 登入參數處理
  - 確認正確接收 apiKey, apiSecret, personId
  - 確認 branch_filter 參數正確處理

- [ ] **檢查項目 2.2**: 分公司名稱顯示
  - 確認 line 116 使用 BRANCH_MAP 正確
  - 確認當 branch_code 不在 BRANCH_MAP 時的 fallback 處理

### Phase 3: 損益資料取得

**檔案**: `backend/core/pnl.py` (line 136-180)

- [ ] **檢查項目 3.1**: 資料取得邏輯
  - 確認正確呼叫 api.list_positions() / api.list_profit_loss()
  - 確認日期範圍參數正確傳遞

- [ ] **檢查項目 3.2**: 帳戶類型判斷
  - 確認正確判斷 Stock / Futures 帳戶
  - 確認 is_futures flag 正確設定

### Phase 4: 標的名稱查詢

**檔案**: `backend/core/pnl.py` (line 187-247)

- [ ] **檢查項目 4.1**: SDK 名稱查詢
  - 確認期貨使用 api.Contracts.Futures[code]
  - 確認股票使用 api.Contracts.Stocks[code]
  - 確認 fallback 機制完整

- [ ] **檢查項目 4.2**: 名稱格式化
  - 確認返回格式："{code} {name}" (例如："TXFK6 台指期")
  - 確認當查詢失敗時，至少返回 code

### Phase 5: 前端資料顯示

**檔案**: `src/components/modals/SyncDateModal.tsx` (line 998-1003)

- [ ] **檢查項目 5.1**: formatSymbolCode 使用
  - 確認正確導入 formatSymbolCode
  - 確認正確處理後端返回的 code

- [ ] **檢查項目 5.2**: Fallback 機制
  - 確認當後端只返回代號時，前端能補上名稱
  - 確認 FUTURES_NAME_MAP 涵蓋主要期貨商品

### Phase 6: 資料儲存

**檔案**: `src/services/brokerService.ts` (saveBrokerTransactions)

- [ ] **檢查項目 6.1**: 資料格式轉換
  - 確認正確轉換 TransactionDetail → Transaction
  - 確認 symbol 欄位儲存完整名稱（含中文）

- [ ] **檢查項目 6.2**: 資料庫儲存
  - 確認正確儲存到 localStorage
  - 確認不會覆蓋現有交易

## 🔧 修正項目

### 修正 1: 確保 branch_code 取得正確

**位置**: `backend/core/pnl.py` line 107

```python
# 現況
bid = str(getattr(acc, "broker_id", "Unknown")).strip()[:4]

# 確認：broker_id 是否正確返回 4 位代碼？
# 需要測試並記錄實際返回值
```

### 修正 2: 增強 BRANCH_MAP 查詢錯誤處理

**位置**: `backend/core/pnl.py` line 116

```python
# 現況
bname = BRANCH_MAP.get(bid, "未知分公司") + f" ({atype})"

# 建議改進：記錄未找到的代碼
if bid not in BRANCH_MAP:
    log(f"⚠️ Branch code not in BRANCH_MAP: {bid}")
bname = BRANCH_MAP.get(bid, f"未知分公司[{bid}]") + f" ({atype})"
```

### 修正 3: 期貨名稱查詢增強記錄

**位置**: `backend/core/pnl.py` line 195-247

```python
# 增加詳細的查詢過程記錄
log(f"🔍 Querying name for {code} (is_futures={is_futures})")
# ... 查詢邏輯 ...
log(f"✅ Found name: {name}")
```

### 修正 4: 前端 formatSymbolCode 容錯

**位置**: `src/utils/symbolNames.ts`

```typescript
// 確保即使 code 是 null/undefined 也能處理
export const formatSymbolCode = (code: string | null | undefined): string => {
  if (!code) return "Unknown";
  // ... 現有邏輯
};
```

### 修正 5: SyncDateModal 顯示邏輯增強

**位置**: `src/components/modals/SyncDateModal.tsx` line 998-1003

```typescript
// 增加錯誤處理
try {
  const formattedCode = formatSymbolCode(tx.code);
  const parts = formattedCode.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
} catch (e) {
  console.error("Format symbol code error:", e);
  return tx.code || "Unknown";
}
```

## 📝 測試計畫

### Test Case 1: 永豐金證券匯入

```
輸入：
- broker_id: 9A9D (永豐金-忠孝)
- apiKey: xxx
- apiSecret: xxx
- personId: xxx
- 日期範圍: 2026-02-01 to 2026-02-06

預期輸出：
- 分公司顯示：永豐金-忠孝 (Stock/Futures)
- 期貨標的顯示：台指期、小台指 等中文名稱
- 股票標的顯示：台積電、鴻海 等中文名稱
```

### Test Case 2: 其他券商匯入

```
測試券商：
- 元大 (9800)
- 凱基 (9200)
- 群益金鼎 (9100)

確認：
- BRANCH_MAP 正確查詢
- 標的名稱正確顯示
```

### Test Case 3: 未知分公司處理

```
輸入：
- broker_id: XXXX (不在 BRANCH_MAP 中)

預期輸出：
- 顯示：未知分公司[XXXX] (Stock)
- 不會導致程式錯誤
```

## 🎯 執行順序

1. **Phase 1-2**: 檢查券商設定和登入流程
2. **Phase 3-4**: 檢查資料取得和名稱查詢
3. **Phase 5-6**: 檢查前端顯示和儲存
4. **修正項目**: 根據檢查結果進行修正
5. **測試驗證**: 執行完整的 End-to-End 測試

## ✅ 完成標準

- [ ] 所有檢查項目都通過
- [ ] 所有修正項目都實施
- [ ] 至少完成 Test Case 1（永豐金）的實際測試
- [ ] 記錄測試結果和任何發現的問題
- [ ] 更新文件說明

---

**建立時間**: 2026-02-06  
**狀態**: 待執行
