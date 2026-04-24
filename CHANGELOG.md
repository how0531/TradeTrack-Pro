# Changelog

All notable changes to this project will be documented in this file.

## [3.2.0] - 2026-04-24

### Fixed — 券商同步「伺服器已重新啟動」錯誤

- **根本原因**：`backend/core/job_store.py` 原本以記憶體 dict 儲存背景同步任務。免費雲端後台 (Render / Zeabur free tier) 因閒置休眠或冷啟動重啟 Flask process 後，`_jobs` 被清空，前端輪詢 `/api/jobs/:id/status` 收到 404 → 顯示「同步失敗：伺服器已重新啟動，同步任務遺失」，使用者無從分辨是「雲端休眠」「券商 API」還是「憑證問題」。
- **修復**：改以 SQLite (`backend/jobs.db`) 持久化 job metadata；**不儲存任何憑證或 payload**，僅保留狀態、進度、結果、錯誤訊息。伺服器重啟後任務狀態仍可查得。

### Added

- **啟動時 Orphan 恢復機制**：`job_store.recover_orphaned_jobs()` 於 Flask 啟動時呼叫，將上一輪仍在 `pending` / `running` 的任務標記為 `error`，並附明確訊息：「伺服器在同步過程中重啟（常見於免費雲端閒置休眠），背景任務已中斷，請重新執行同步。」避免使用者在前端看到無意義的 404。
- **前端 404 容忍重試**：`brokerService.ts` 輪詢 job status 時若收到 404，先連續重試 3 次（每 2 秒）再放棄，以容忍冷啟動瞬斷；放棄後顯示指向雲端方案本身的訊息，引導使用者重試或升級方案。
- **後端 404 回應增加 `reason` 欄位**：`/api/jobs/:id/status` 與 `/api/jobs/:id/result` 在任務不存在時回 `{ status: "error", reason: "job_not_found", message: "..." }`，便於前端分類處理。

### Changed

- **Job 保留時間由 1 小時 → 24 小時**：`cleanup_old_jobs()` 預設 `older_than_seconds` 由 `3600` 調整為 `86400`，避免使用者慢了一拍就撈不到結果。
- **版本號同步**：`package.json` 3.0.4 → 3.2.0（補齊 CHANGELOG 進度並反映此次架構改動）；後端 `/` endpoint 回報的 `version` 由 `v1.3.1` → `v1.4.0`。

### Verification

- 後端新增 7 項端到端測試（CRUD、錯誤流程、orphan 恢復、冪等性、missing job、concurrent create、cleanup 24h），全部通過。
- `.gitignore` 排除 `backend/jobs.db*` 等 SQLite 執行期檔案。

## [3.1.1] - 2026-04-12

### Fixed — 券商同步根本問題修復

- **`list_profit_loss` 型別錯誤**：Shioaji SDK 要求傳入 `datetime.date` 物件，舊版誤傳字串導致靜默回傳空值。現於 `_fetch_single_account` 中強制轉型，並補齊錯誤日期格式的 early-return 保護。
- **CA 憑證狀態偽陽性**：`activate_ca` 在部分 SDK 版本回傳 `None` 而非 `False` 表示失敗，原先 `if result is False` 判斷遺漏此情況，導致 CA 狀態被誤標為「已啟動」。改以 `if not result` 統一攔截。
- **CA 本地快取遮蔽 Shioaji 內部失效**：Session 中的 `ca_activated` 旗標（最長快取 30 分鐘）無法反映 Shioaji 底層 CA 狀態的實際失效。修復方式：PnL 查詢前一律以 `force=True` 強制重新呼叫 `activate_ca`，確保狀態同步。
- **CA 啟動失敗訊息模糊**：現區分三種情況給出對應提示——①已上傳 caContent 但 activate_ca 未成功（密碼可能錯誤）、②雲端找不到 .pfx 檔案（需重新上傳）、③其他啟動失敗。
- **日期範圍未驗證**：新增後端防護——起始日晚於結束日直接回傳明確錯誤；結束日超過今天自動截斷為今天，不再送出無效請求給 Shioaji。
- **例外分類過於籠統**：後端最外層 `except` 現對常見錯誤分類為使用者友善訊息（API Key 無效、帳號授權、CA 錯誤、登入逾時、網路連線失敗、環境不符），取代原本直接拋出 SDK 原始訊息。
- **`caPath` 驗證阻斷雲端部署**：所有後端端點（`/api/broker/profile`、`/api/jobs/pnl`、`/api/broker/verify`）的必填欄位驗證改為接受 `caPath` 或 `caContent` 二擇一，不再強制需要本地路徑。

### Added

- **每日損益彙總回應**：後端 PnL 回應新增 `daily_results` 欄位，前端不再需要自行計算。
- **CA 狀態與空資料原因欄位**：`BrokerSyncResult` 新增 `caStatus`、`emptyReason`，供前端區分「CA 未啟動」與「區間無交易」兩種空值情況。
- **前端型別補齊**：`TransactionDetail` 新增 `entryPrice`、`exitPrice` 可選欄位。

### Changed — 行動端同步體驗優化

- **智慧日期預填**：`SyncDateModal` 開啟時自動將起始日設為上次同步結束日的隔天，終止日設為今天，省去手動調整。
- **「上次至今」快速按鈕**：有上次同步紀錄時顯示，一鍵還原最常用日期範圍。
- **連線後自動同步 (`autoSyncOnWake`)**：後端從休眠恢復為 online 後，自動觸發同步，不需使用者再次點擊。
- **休眠覆蓋層重設計**：顯示「同步意圖卡」預覽即將同步的日期與帳號數，並提供自動同步開關，取代原本僅顯示旋轉動畫的等待畫面。
- **Footer 按鈕語境化**：休眠/連線中狀態下按鈕樣式改為藍色，文字顯示「連線後自動同步」或「立即啟動同步」。

### Infrastructure

- **`BackendContext` 重構**：改為訂閱 `backendGateway` 單一狀態來源，移除冗餘的獨立 health check 輪詢與 30 秒計時器。
- **`useBrokerStatus.ts` 移除**：功能已整合至 `BackendContext`，廢棄檔案刪除。
- **Render worker 調整**：`gunicorn` workers 從 2 調整為 1，加入 `--timeout 120`，減少 Render 免費方案記憶體壓力。
- **Zeabur 部署 Node 環境修正**：於 `package.json` 加入 `engines` 強制指定 Node.js 20 以上版本，根治靜態部署時容器自動執行 `npm update -g npm` 而拋出 `promise-retry` 遺失的崩潰問題。

## [3.0.3] - 2026-03-19

### Performance
- **後端架構革新與效能破界 (Cloud PnL Speedup)**：
  - 徹底移除了 Shioaji 執行環境在 `is_futures` 判斷時的同步延遲策略與重試邏輯，改採「Sequential-Fast 平行化」查詢架構。
  - 雲端環境（Render）在喚醒 (熱啟動) 狀態下，現在讀取完整 11 個月、雙帳戶（期貨 + 台股）資料僅需 **6 小秒**，效能直接飆升，不再發生數分鐘阻塞！

### Fixed / Changed
- **前端智慧請求整併 (UI Request Grouping)**：修復了前端 `SyncDateModal` 中因為「不同掛載目標投資組合」而將期貨和證券的查詢「被硬性拆分為 6 大塊」的 UI 迴圈邏輯。現在前端無論勾選多少個券商帳戶，皆會 100% 打包成單一請求，並根據回傳 Payload 自動智慧導流進相對應的 Portfolio，徹底杜絕重複 Login Shioaji 的延遲。
- **UIUX 元件左對齊強迫症修復**：修正 `BrokerSettings.tsx` 中「取得 API 金鑰與憑證」與「輸入用戶資訊」容器不在同一個基準垂線的問題。現在會將文案統整為外層 `h5` 標題（並附上 `pl-1`），同時精簡活動框 (Action Box) 中多餘的敘述，讓兩顆按鈕 (`查看開通步驟`、`前往申請`) 平衡且完美對稱填滿空間。
- **「0開頭」複委託誤判阻斷**：修復了 `backend/core/pnl.py` 裡過度嚴苛的防呆正規檢查——原本帳戶名稱若為 0 開頭 (如 `0264298`) 會無條件被判定成 `SubBrokerage` 並遭後端剔除。修改後將全面依賴券商端 API 發出的 Type Enum 來作為唯一認定標準。

## [3.0.2] - 2026-03-18

### Fixed
- **完全修復 Zeabur Frontend `502 Bad Gateway` 錯誤**：捨棄 Docker 方案，改採 Zeabur 原生靜態邊緣託管 (Native Static Edge Hosting)，並新增 `zeabur.json` 徹底消除 Port 橋接失敗問題。
- **優化後端喚醒流程**：將 `validateBackendStatus` 逾時從 90 秒縮短至 8 秒，並導入狀態查詢連線指數退避 (Exponential Backoff) 輪詢，不會再因為長線程阻塞 UI，或導致無窮盡的渲染重置。
- 修復 `SyncDateModal` 自動 Ping 迴圈競態條件。
- 修復券商損益匯入時，如果後端處於 502 冷啟動狀態會產生「JSON 格式無法解析」的誤導錯誤，現在會正確顯示「後端冷啟動中」的提示。

## [3.0.1] - 2026-03-16

### Changed (Features & Architecture)

- **券商損益大數據匯入優化 (Data Chunking)**：
  - **前端智能分塊**：查詢大於一整個月的區間時，前端會自動拆分為多個 30 天的小片段 (Chunks) 並循序向後端請求，徹底解決 Shioaji 大區段查詢導致的 `Timeout` 或崩潰問題。
  - **動態進度回饋 (Progress UI)**：因應分塊查詢時間拉長，介面上會完整顯示目前的下載進度 (例如：`正在下載: 區塊 1/12...`) 與動態進度條。
  - **圖表視覺優化**：縮小並柔化了周/月頻率圖表中的「創歷史新高」點位，讓主視覺不再被點位過度干擾。
  - **UI 防遮擋修復**：新增 iPhone 動態島 (Dynamic Island) 與瀏海 (Notch) 的 `safe-area-inset-top` 邊距支援，防止頂部元件被系統 UI 遮擋。

### Fixed

- **靜默失敗阻斷 (Fail-Fast Error Propagation)**：修復舊版後端在遇到券商連線異常時，誤將空陣列與 `success` 回傳給前端導致的資料遺漏。現在發生異常會嚴格回傳 Error 中斷前端匯入。
- **解決多帳號連續查詢失敗 (CA Persistent File Fix)**：修復「同時勾選期貨與證券帳號」時，Shioaji C++ 底層因暫時 `.pfx` 憑證檔被提前刪除而發生的簽名崩潰，現在後端會以 `person_id` 為基礎穩定留存暫存憑證供重複連線使用。

## [2.5.11] - 2026-03-16

### Changed (Features)

- **資料存儲與同步架構全面升級**：
  - **智慧合併**：衝突發生時提供「智慧合併」選項，自動以 ID 比對合併雲端與本地資料。
  - **自動去重**：不論是同步拉取或智慧合併，系統皆會自動偵測並移除重複交易紀錄。
  - **登出自動備份**：優化登出流程，登出清空本機資料前會自動觸發雲端備份，防止資料遺失。
  - **衝突預覽**：解決衝突時會顯示本地、雲端與可能重複的資料筆數概覽。

## [2.5.10] - 2026-03-16

### Fixed

- **Zeabur 502 Bad Gateway 優化**：新增 `zbpack.json` 強制指定靜態網站打包輸出，並同時在 `package.json` 中加入 `serve` 作為 fallback 啟動腳本。確保不論 Zeabur 將專案識別為 Static 還是 Node.js 服務，都能正確監聽連接埠並部署 SPA，徹底根除 502 路由異常。

## [2.5.9] - 2026-03-12

### Fixed

- **雲端部署 502 Bad Gateway 修復**：移除了 `zeabur.toml` 中前端服務多餘的 `start = "npm run preview"` 指令，讓 Zeabur 能夠正確使用 Nginx 託管靜態路由，徹底解決手機版與網頁版存取時發生的 502 錯誤與白畫面問題。

## [2.5.8] - 2026-03-02

### Changed (Optimizations)

- **API 效能與穩定性優化**：移除後端 `ensure_ca_active` 的重複呼叫，每次請求減少約 500ms 延遲，並降低 Shioaji API 狀態異常風險。
- **憑證檢測 (CA Probe) 智慧化**：精準區分帳號類型，期貨帳號使用 `margin()` 偵測，股票帳號自動切換為 `list_positions()`，徹底消除股票帳號的系統誤報。
- **前端狀態處理防護**：大幅強化 `useMetrics` 對邊界值的容錯能力，過濾無效或空日期的交易、新增 NaN 排序防護，及 `dailyPnlMap` 日期格式驗證，提升系統整體穩定性與崩潰防護。
- **前端時區相容性優化**：`SyncDateModal` 全面改用 `/` 分隔符強制本地時間解析，完美避開 iOS / Safari 瀏覽器底層的 UTC 時區自動偏移問題。

### Fixed

- **匯入資料不顯示修正**：修復手機板匯入交易損益後，權益曲線、紀錄、日曆全部空白的核心問題。主因為更新後 `portfolioId` 未正確加入 `activePortfolioIds`，導致被過濾。
- **匯入欄位遺漏**：`handleSyncSuccess` 補齊 `price`、`raw_yield`、`yield`、`points` 四個關鍵欄位，解決 LogsView 報酬率與點數顯示空白的 Bug。
- **後端日期解析強化**：`pnl.py` 新增支援 `datetime.date` 物件、`20250401`、`2025-04-01` 等多種格式，解決永豐 API 跨版本回傳格式差異所造成的 NaN 問題。
- **期貨報酬率計算修正**：精準加入期貨合約乘數（如台指期 200、小台 50、電子期 4000 等），修正以往可能將 1% 獲利誤算為 200% 的嚴重計算偏差。

## [2.5.7] - 2026-02-26

### Fixed

- **同步資料顯示異常**：修復 API 回傳特定日期格式 (如 `.` 或 `/`) 導致 Safari/iOS 時間軸位移與無回退渲染的錯誤，全面正規化日期為 `YYYY-MM-DD` 並統一至當地時間顯示，解決圓圈標記無法顯示的問題。

## [2.5.6] - 2026-02-25

### Changed

- **設定檔分析效能**：Ghost / Duplicate 偵測邏輯改用 `useMemo` 快取，避免每次 render 重新計算。
- **一鍵修復可讀性**：將 100 行 `onClick` 內嵌邏輯抽取為獨立 `handleFixConfigIssues` 函式。
- **帳戶刪除體驗**：移除 `window.confirm` 彈窗，改為 inline 紅色確認按鈕（2 秒無操作自動收回），符合暗色系 UI 風格。
- **登出 Modal 語系**：說明文字與按鈕文案跟隨語系切換（中文 / 英文），不再全英文 hardcode。
- **帳戶儲存優化**：`AccountRow.handleSave` 合併連續兩次 `updatePortfolio` 為 batch update。

### Fixed

- **雲端憑證驗證**：`caPath` 驗證改為同時接受 `caContent` (base64)，雲端部署用戶不再被攔截。
- **重複 import 清理**：合併分散的 `useEffect` import 至主 React import。
- **重複註解清理**：移除 `SettingsView` 中重複的元件標頭註解。
- **死碼清理**：移除未使用的 `ddPercent` / `streakPercent` 計算。

## [2.5.5] - 2026-02-25

### Added

- **API 錯誤提示強化**：券商同步模態框 (`SyncDateModal`) 現在會完整收集並顯示後端返回的所有錯誤訊息，不再靜默失敗。
- **同步失敗原因顯示**：交易檢核頁面的空狀態（NO DATA FOUND）現在會顯示具體錯誤原因（如「無法連接後端伺服器」），不再只顯示空白。

### Changed

- **期貨損益顯示直覺化**：同步預覽畫面中的期貨損益，全面改為直接顯示「實際獲利金額」，移除容易造成混淆的「點數」換算邏輯。
- **重複交易偵測更精準**：重構 `duplicateDetection` 邏輯，放寬手續費容錯區間至 ±2 元，且針對零數量/零價格交易進行嚴格比對，與同步核心邏輯完全對齊，大幅降低誤判率。

### Fixed

- **帳戶載入效能優化**：修復了每次打開「券商設定」或首頁時都會強制讀取憑證與完整損益的效能缺陷。現在改為輕量化設計 (`profile_only`)，僅需幾毫秒即可載入帳號清單。
- **憑證安全機制**：修補了後端核心模組中暫存憑證檔案 (`.pfx`) 可能因報錯而未被刪除的安全漏洞，導入嚴格的 `try...finally` 清理機制。
- **程式碼健壯性**：移除了後端損益模組的殘留廢棄程式碼，並修復了 CA 憑證路徑解析的反斜線錯誤。
- **Session 管理穩定性**：Thread-safe singleton 避免 race condition、Login 超時後主動清理殭屍連線、Health check 加 5 秒 timeout 防止 deadlock。
- **`profile_only` CA 不阻斷**：帳號列表模式下 CA 啟動失敗不再阻斷流程，用戶仍可正常瀏覽帳號清單。
- **前端 Fetch Timeout**：`fetchBrokerProfile` 每次 retry 加 45 秒 timeout、`verifyBrokerAccount` 加 30 秒 timeout，避免永久 pending。
- **計時器洩漏修復**：修復 `BrokerSettings` 元件卸載後 `setInterval` 計時器未清理導致的記憶體洩漏。
- **setState Race Condition**：合併連續兩次 `setState` 為一次 atomic update，修復 CA 路徑清除時的競態條件。
- **Flask Debug 安全**：`debug=True` 改為環境變數控制，避免 production 暴露 Werkzeug debugger。

## [2.4.12] - 2026-02-24

### Changed

- **UI/UX 滾動條重構**：全面將系統預設醜陋的灰色捲動條替換為纖細、帶有深色軌道與低調金銅色點綴的 `.custom-scrollbar`，符合 `@ui_ux_pro_max` 奢華暗色系主題。
- **券商設定模態框 (Stepper) 完美對齊**：放棄不穩定的絕對百分比定位，改採 `flex-1` 與 `shrink-0` 彈性排版重新建構「新增券商帳號」的進度條。徹底解決任何螢幕寬度下的線條跑出邊界與不對齊問題。
- **UI 錯誤修正**：移除了券商連線進度中殘留的幽靈背景數字「3」，完美符合當前雙步驟的設計。

## [2.4.2] - 2026-02-12

- **本地完整股票清單**：建立了包含 2,421 檔台股（上市、上櫃、興櫃與 ETF）的本地對照表，顯著提升查找速度至毫秒級。
- **雙向股票查找功能**：支援「代碼查名稱」與「名稱查代碼」雙向自動補全，並優化了相似名稱的模糊匹配優先級。
- **一鍵自動化更新**：建立 `scripts/update_stocks.bat` 供本地一鍵更新，並配置 GitHub Actions 每月自動從 TWSE 抓取最新清單並提交更新。
- **智能爬蟲過濾**：開發 Python 爬蟲腳本，精準過濾掉權證與衍生商品，保留乾淨的交易商品清單。

## [2.4.0] - 2026-02-11

### Added

- **複委託帳戶處理**：正式區分並標註複委託帳號為「券商尚未支援」，並點對點隱藏不支援的驗證按鈕。
- **一鍵憑證上傳流**：支援直接在設定頁上傳 `.pfx` 憑證內容，並在上傳成功後自動觸發重新驗證，優化「修復 -> 驗證」的閉環體驗。
- **驗證狀態視覺化**：將驗證狀態標籤移至帳號標題右側，提供更清晰的視覺層次。
- **夏普比率實作**：正式導入夏普比率 (Sharpe Ratio) 計算邏輯，基於日化報酬率與年化標準差 ($\sqrt{252}$)，提供精確的風險調整後報酬指標。
- **期望值 (Expectancy) 指標**：新增「期望值」卡片，顯示每筆交易的平均預期獲利，彌補高勝率但低賺賠比策略的盲點，協助量化策略真實優勢。

### Fixed

- **驗證流程穩定性**：
  - 移除了導致崩潰的錯誤 API 呼叫 (`set_account`)。
  - 補足了 `pnl.py` 中缺失的 `shioaji` 套件引用。
  - 修正了存取 `Order` 物件屬性時的 `AttributeError`。
- **UI 互動修復**：解決了檔案上傳元件在選擇相同檔案時不會觸發 Change 事件的問題。
- **版本標記**：全面更新設定資訊看板的版本資訊為 `V2.4.0`。

## [1.1.0] - 2026-01-25

### Added

- **永豐金原生串接 (Shioaji API)**：正式支援永豐金證券自動同步損益資料。
- **雲端佈署支援 (Cloud Ready)**：
  - 新增 `gunicorn` 生產級伺服器配置。
  - 支援 `render.yaml` 與 `Dockerfile` 一鍵佈署至雲端平台。
  - 前端支援動態切換後端網址（透過 `VITE_API_URL`）。
- **個股名稱自動對應**：匯入時自動抓取股票中文名稱，提升對帳體驗。
- **分公司精準匹配**：完整的分公司代碼地圖，支援嚴格的大小寫區分。

### Fixed

- **帳戶選擇優化**：自動識別並優先使用「證券」類型的帳戶，解決多帳號混淆問題。
- **連接穩定性**：修復了 Shioaji SDK 核心登入方法報錯。
- **資料完整性**：解決了損益明細 (Details) 遺失導致前端無法顯示的問題。
- **後端自動重啟**：`start.bat` 加入異常偵測與自動重啟機制。

### Added

- **UI/UX 強化**：全新的儀表板設計，包含情緒顏色漸層背景 (Mood Gradient)。
- **隱私模式 (Hide Amounts)**：支援全文模糊效果 (Blur)，保護敏感交易金額，適用於主畫面、分享卡片與圖表提示框。
- **圖表動畫**：切換「純損益」與「淨值」視圖時新增平滑動態過渡。
- **日期顯示優化**：全域日期格式統一為 `YYYY/MM/DD`，包含年份顯示。
- **分享功能**：完整的交易結果分享卡片，支援自定義顯示模式與圖片下載。
- **風險警報系統**：當回撤 (Drawdown) 或連敗 (Loss Streak) 超過閾值時，自動觸發紅色警報提醒。
- **多語系支援**：完整繁體中文 (台灣) 與英文介面切換。

### Fixed

- 修復了 App.tsx 中的變數重複宣告問題。
- 優化了 Firebase 同步邏輯，解決了潛在的衝突問題。
- 修正了圖表在極端縮放下的顯示異常。
