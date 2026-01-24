# 📈 TradeTrack Pro

<div align="center">
  <img width="1200" height="475" alt="TradeTrack Pro Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  <p align="center">
    <img src="https://img.shields.io/badge/Version-1.0.0-gold?style=for-the-badge" alt="Version" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  </p>
</div>

---

**TradeTrack Pro** 是一款專為專業交易者打造的績效追蹤與心理分析儀表板。不僅能記錄損益，更能透過精準的數據可視化與風險監控，協助您建立穩健的交易系統。

## 🌟 核心亮點

### 1. 進階數據可視化

- **動態淨值曲線**：支援「純損益」與「含本金淨值」切換，配備平滑過渡動畫。
- **情緒背景漸層 (Mood Gradient)**：系統根據您的勝率與近期表現，自動調整界面光暈背景。
- **多維度分析**：依策略、心理情緒、投資組合進行細分統計。

### 2. 隱私與安全性

- **專業隱私模式 (Privacy Blur)**：一鍵開啟全域模糊效果，隱藏所有金額顯示。適用於公開分享績效卡片，同時保留數據結構的可讀性。
- **Firebase 實時同步**：數據加密同步至雲端，支援多裝置存取與登入。

### 3. 風險控管預警

- **Drawdown 警報**：當帳戶回撤達到預設比例時，自動觸發紅色風險視覺警示。
- **連敗暫停建議**：自動偵測連敗次數，提醒交易者適時休息。

### 4. 社交分享

- **績效卡片生成**：內建美觀的分享卡片模組，可自定義日期範圍、顯示項目並一鍵下載。

## 🛠 技術棧

- **Frontend**: React (Hooks, Context API)
- **Styling**: Tailwind CSS, Vanilla CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Backend**: Firebase (Firestore, Authentication)
- **Build Tool**: Vite

## 🚀 快速開始

### 環境要求

- Node.js v18.0.0 或更高版本

### 安裝與啟動

1. **Clone 專案**

   ```bash
   git clone https://github.com/how0531/TradeTrack-Pro.git
   cd TradeTrack-Pro
   ```

2. **安裝依賴**

   ```bash
   npm install
   ```

3. **配置環境變數**
   建立 `.env.local` 檔案並填入您的 Firebase 設定：

   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. **啟動開發環境**
   ```bash
   npm run dev
   ```

## 📄 版本更新

詳細變更紀錄請參閱 [CHANGELOG.md](./CHANGELOG.md)。

---

_如有任何問題或功能建議，歡迎提交 Issue 或 Pull Request。_
