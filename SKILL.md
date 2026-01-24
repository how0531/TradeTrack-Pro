---
name: shioaji
description: 永豐金證券 Shioaji API 開發技能，包含登入、報價、下單與帳務處理。
---

# Shioaji API 開發指南

## 1. 初始化與登入 (FastAPI 實作)

```python
import shioaji as sj
import os
from dotenv import load_dotenv

load_dotenv()

api = sj.Shioaji(simulation=True) # 預設開啟模擬環境

def login():
    # 使用 Token 登入 (Shioaji >= 1.0)
    accounts = api.login(
        api_key=os.getenv("API_KEY"),
        secret_key=os.getenv("SECRET_KEY"),
        fetch_contract=True
    )
    # 啟用憑證 (下單必備)
    api.activate_ca(
        ca_path=os.getenv("CA_CERT_PATH"),
        ca_passwd=os.getenv("CA_PASSWORD"),
        person_id=os.getenv("PERSON_ID")
    )
    return accounts
```

## 2. 獲取商品資訊

```python
# 獲取台積電 (2330) 合約
contract = api.Contracts.Stocks["2330"]
```

## 3. 即時報價

### 訂閱 Tick 資料

```python
@api.on_tick_stk_v1()
def on_tick(exchange, tick):
    print(f"Tick: {tick}")

api.quote.subscribe(contract, quote_type=sj.constant.QuoteType.Tick)
```

### 獲取 Snapshot (快照)

```python
snapshots = api.snapshots([contract])
```

## 4. 下單與交易

```python
order = api.Order(
    price=600,
    quantity=1,
    action=sj.constant.Action.Buy,
    price_type=sj.constant.StockPriceType.LMT,
    order_type=sj.constant.OrderType.ROD,
    account=api.stock_account
)
trade = api.place_order(contract, order)
```

## 5. 帳務查詢

### 未實現損益

```python
positions = api.list_positions(unit=sj.constant.Unit.Share)
```

### 已實現損益

```python
pnl = api.list_profit_loss(api.stock_account, "2024-01-01", "2024-01-24")
```

## 6. 委託改刪 (Cancel & Update)

### 刪單 (Cancel Order)

```python
api.update_status(api.stock_account) # 務必先更新委託狀態
trade = api.list_trades(api.stock_account)[0] # 取得第一筆委託
api.cancel_order(trade)
```

### 改價/減量 (Update Price/Qty)

```python
api.update_status(api.stock_account)
trade = api.list_trades(api.stock_account)[0]

# 改價 (直接傳入新價格)
api.update_order(trade=trade, price=605)

# 減量 (傳入"欲減少"的數量)
api.update_order(trade=trade, qty=1)
```

## 7. 期貨與選擇權 (Futures & Options)

### 期貨下單

```python
# 獲取台指期近月合約 (TXF)
contract = api.Contracts.Futures["TXF"]["TXFR1"]

order = api.Order(
    action=sj.constant.Action.Buy,
    price=16000,
    quantity=1,
    price_type=sj.constant.FuturesPriceType.LMT,
    order_type=sj.constant.OrderType.ROD,
    octype=sj.constant.FuturesOCType.Auto, # 自動判定新倉平倉
    account=api.futures_account # 注意: 需使用期貨帳號
)
trade = api.place_order(contract, order)
```

## 8. 歷史數據 (Historical Data)

### K 線資料 (KBars)

```python
# 獲取日 K 線 (1分/5分/30分/60分/日)
kbars = api.kbars(
    contract=api.Contracts.Stocks["2330"],
    start="2024-01-01",
    end="2024-01-24"
)

# 轉為 DataFrame
import pandas as pd
df = pd.DataFrame({**kbars})
df.ts = pd.to_datetime(df.ts)
print(df.head())
```

> [!TIP]
> 確保電腦時間已校準，否則登入時可能會遇到 `Sign data is timeout` 錯誤。
