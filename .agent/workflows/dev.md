---
description: 啟動本地開發環境（前端 + 後端）
---

# 啟動本地開發環境

## 步驟

1. 安裝前端依賴

```bash
npm install
```

// turbo
2. 啟動前端 dev server（port 5173）

```bash
npm run dev
```

3. （可選）啟動後端 — 需要 Python 環境

```bash
cd backend && python app.py
```

> [!NOTE]
> 前端透過 `vite.config.ts` 的 proxy 設定自動將 `/api` 請求轉發到 `localhost:5000`。
> 如不需要券商同步功能，可以只啟動前端。
