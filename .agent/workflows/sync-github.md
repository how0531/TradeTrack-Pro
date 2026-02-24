---
description: 以 GitHub 遠端為準同步本地檔案
---

# 以 GitHub 為準同步本地

> [!WARNING]
> 此操作會**丟棄所有本地未 commit 的變更**，請確認後再執行。

// turbo-all

## 步驟

1. 從遠端拉取最新程式碼

```powershell
git fetch origin
```

2. 將本地 main 分支強制對齊遠端

```powershell
git reset --hard origin/main
```

3. 清除未追蹤的檔案與目錄

```powershell
git clean -fd
```

4. 確認同步結果

```powershell
git log --oneline -5
```
