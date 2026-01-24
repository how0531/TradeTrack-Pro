# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-24

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
