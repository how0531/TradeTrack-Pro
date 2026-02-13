---
name: shioaji_broker
description: Official Shioaji API integration for SinoPac securities trading (Stock/Futures/Options).
---

# Shioaji Broker Skill

This skill provides a comprehensive guide and tools for integrating the Shioaji (SinoPac) Python API into your trading application.

## 1. Installation

```bash
pip install shioaji
```

## 2. Authentication

Shioaji requires a `person_id` (ID number) and `password`. For simulation, use the simulation account.

```python
import shioaji as sj

api = sj.Shioaji()
api.login(
    person_id="YOUR_ID",
    passwd="YOUR_PASSWORD",
    contracts_cb=lambda security_type: print(f"{security_type} contracts loaded.")
)
```

## 3. Market Data

### Real-time Quotes

```python
# Subscribe to real-time quotes/ticks
contract = api.Contracts.Stocks["2890"]
api.quote.subscribe(
    contract,
    quote_type=sj.constant.QuoteType.Tick, # or BidAsk
    version=sj.constant.QuoteVersion.v1
)

# Callback for receiving data
@api.on_quote
def quote_callback(topic: str, quote: dict):
    print(f"Topic: {topic}, Quote: {quote}")
```

### Snapshots

```python
snapshot = api.snapshots([api.Contracts.Stocks["2890"]])
print(snapshot)
```

## 4. Order Placement

### Stock Order (Limit Price)

```python
contract = api.Contracts.Stocks["2890"]
order = api.Order(
    price=12.5,
    quantity=1,
    action=sj.constant.Action.Buy,
    price_type=sj.constant.StockPriceType.Limit,
    order_type=sj.constant.OrderType.ROD,
    account=api.stock_account
)
trade = api.place_order(contract, order)
print(trade)
```

### Futures Order

```python
contract = api.Contracts.Futures.TXF.TXFR1
order = api.Order(
    price=16000,
    quantity=1,
    action=sj.constant.Action.Buy,
    price_type=sj.constant.FuturesPriceType.Limit,
    order_type=sj.constant.OrderType.ROD,
    octype=sj.constant.FuturesOCType.Auto,
    account=api.futures_account
)
trade = api.place_order(contract, order)
```

## 5. Account Data

### Balance & Positions

```python
# refresh positions
api.update_status(api.stock_account)
print(api.list_positions(api.stock_account))

# Settlement info
print(api.list_settlements(api.stock_account))
```

## 6. Order Management (Cancel & Update)

### Cancel Order

```python
api.update_status(api.stock_account) # Update status first
trade = api.list_trades(api.stock_account)[0] # Get first trade
api.cancel_order(trade)
```

### Update Price/Quantity

```python
api.update_status(api.stock_account)
trade = api.list_trades(api.stock_account)[0]

# Update Price
api.update_order(trade=trade, price=605)

# Update Quantity (Reduce quantity)
api.update_order(trade=trade, qty=1)
```

## 7. Historical Data (KBars)

```python
# Get Daily KBars
kbars = api.kbars(
    contract=api.Contracts.Stocks["2330"],
    start="2024-01-01",
    end="2024-01-24"
)

# Convert to DataFrame
import pandas as pd
df = pd.DataFrame({**kbars})
df.ts = pd.to_datetime(df.ts)
print(df.head())
```

## 8. Resources

- **Official Documentation**: [https://sinotrade.github.io/](https://sinotrade.github.io/)
- **GitHub Repository**: [https://github.com/Sinotrade/Shioaji](https://github.com/Sinotrade/Shioaji)
- **Simulation Account**: Apply at [SinoPac API Site](https://www.sinotrade.com.tw/ec/api/index.html)

## 9. Advanced API Documentation

A full API reference guide (LLM optimized) is available locally:

- **Path**: `.agent/skills/shioaji_broker/resources/api_docs.txt`
- **Content**: Detailed usage for Login, Market Data (Ticks/KBar), Order Management, and Settlements.
- **Usage**: Read this file when you need specific parameter details or advanced examples not covered above.
