# 券商代碼對照系統整合說明

## 📋 概述

成功整合臺灣證券交易所的 **838 筆券商/分公司資料**，確保匯入券商交易時能正確顯示中文名稱。

## ✅ 已完成的整合

### 1. 資料檔案生成

- ✅ `backend/core/broker_branches.json` - JSON 格式資料庫
- ✅ `backend/core/constants.py` - Python 常數對照表（含 BRANCH_MAP）
- ✅ 共 838 筆資料，涵蓋所有主要券商及分公司

### 2. 後端整合 (`backend/core/pnl.py`)

#### 分公司名稱顯示 (Line 116)

```python
bname = BRANCH_MAP.get(bid, "未知分公司") + f" ({atype})"
```

- 當用戶有多個帳戶時，顯示分公司中文名稱
- 自動添加帳戶類型標記（Stock/Futures）

#### 標的名稱查詢 (Line 187-247)

```python
# 1. 嘗試從 PnL 物件直接取得
name = getattr(item, "item_name", ...)

# 2. 從 Shioaji SDK 查詢
if is_futures:
    contract = api.Contracts.Futures[code]
    name = getattr(contract, "name", "")

# 3. 格式化顯示
display_code = f"{code} {name}" if name else code
```

### 3. 前端整合 (`src/utils/symbolNames.ts`)

#### Fallback 機制

```typescript
export const FUTURES_NAME_MAP = {
    'TXF': '台指期',
    'MTX': '小台指',
    'TE': '電子期',
    ...
}

export const formatSymbolCode = (code: string): string => {
    // 如果後端已返回完整名稱，直接使用
    if (code.includes(' ')) return code;

    // Fallback: 前端推測期貨名稱
    const futuresName = guessFuturesName(code);
    return futuresName ? `${code} ${futuresName}` : code;
}
```

#### 顯示邏輯 (`SyncDateModal.tsx` Line 998-1003)

```typescript
const formattedCode = formatSymbolCode(tx.code);
const parts = formattedCode.split(" ");
// 只顯示中文名稱部分
return parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
```

## 🔄 資料流程

```
1. 後端 (pnl.py)
   ├─ 從 BRANCH_MAP 取得分公司名稱
   ├─ 從 Shioaji SDK 查詢標的名稱
   └─ 返回 {"code": "TXFK6 台指期", ...}

2. 前端接收
   ├─ 如已有中文名稱 → 直接使用
   └─ 如只有代號 → 使用 formatSymbolCode 補上名稱

3. 顯示結果
   └─ UI 顯示: "台指期" 或 "台積電"
```

## 📊 涵蓋範圍

### 主要券商分公司數量

- **永豐金**: 56 筆（9A 開頭）
- **元大**: 200+ 筆（98 開頭）
- **凱基**: 100+ 筆（92 開頭）
- **群益金鼎**: 80+ 筆（91 開頭）
- **富邦**: 80+ 筆（96 開頭）
- **國泰**: 15+ 筆（88 開頭）
- **台新**: 13 筆（81 開頭）
- **兆豐**: 60+ 筆（70 開頭）
- 其他券商: 200+ 筆

### 測試驗證

```bash
# 執行測試
python backend/scripts/test_branch_map.py

# 預期輸出
✅ 永豐金相關: 56 筆
✅ 總計: 838 筆券商/分公司資料
✅ 測試完成！
```

## 🔧 維護更新

### 定期更新資料

```bash
# 1. 從證交所網站取得最新資料
#    網址: https://www.twse.com.tw/zh/products/broker/infomation/list.html

# 2. 複製資料並更新 parse_broker_data.py 的 RAW_DATA

# 3. 重新生成資料
python backend/scripts/parse_broker_data.py

# 4. 測試驗證
python backend/scripts/test_branch_map.py
```

### 手動新增特定券商

編輯 `backend/core/constants.py` 的 BRANCH_MAP：

```python
BRANCH_MAP = {
    "新代碼": "新券商名稱",
    ...
}
```

## ⚠️ 注意事項

1. **期貨標的顯示**
   - 優先使用後端從 SDK 查詢的名稱
   - 如查詢失敗，前端會使用 fallback 推測

2. **分公司代碼**
   - 代碼必須是 4 位（例如："9A9D"）
   - 大小寫敏感

3. **效能考量**
   - BRANCH_MAP 在啟動時載入，不影響執行效率
   - 前端 fallback 僅在必要時使用

## 🎯 預期效果

### 匯入前

```
分公司: 9A9D
標的: TXFK6
```

### 匯入後

```
分公司: 永豐金-忠孝 (Stock)
標的: 台指期
```

## ✅ 完成檢查清單

- [x] 資料檔案已生成（838 筆）
- [x] 後端 constants.py 已更新
- [x] pnl.py 正確使用 BRANCH_MAP
- [x] 前端 fallback 機制已建立
- [x] SyncDateModal 使用 formatSymbolCode
- [x] 測試腳本執行通過
- [x] 整合說明文件完成

---

**資料來源**: 臺灣證券交易所  
**更新日期**: 2026-02-06  
**維護**: TradeTrack-Pro 開發團隊
