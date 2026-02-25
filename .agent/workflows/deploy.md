---
description: 提交變更並部署至雲端（Zeabur / Render）
---

# 部署至雲端

## 部署前必做

> [!IMPORTANT]
> 每次推送改版前，務必確認以下三處版本號已更新：
>
> 1. `src/constants.ts` → `APP_VERSION`（設定頁面顯示）
> 2. `package.json` → `version`
> 3. `CHANGELOG.md` → 新增對應版本的變更記錄

## 步驟

1. 確認前端 build 通過

```bash
npm run build
```

2. 暫存所有變更

```bash
git add -A
```

3. 提交 commit（請替換 commit message）

```bash
git commit -m "feat: <描述變更內容>"
```

4. 推送至 GitHub（觸發自動部署）

```bash
git push origin main
```

> [!NOTE]
>
> - **前端**：push 後 Zeabur 會自動偵測並部署
> - **後端**：若有 `backend/` 變更，Render 會自動重新部署
> - Render 免費版首次啟動需約 30 秒
