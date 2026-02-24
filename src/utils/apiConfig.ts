/**
 * 統一 API Base URL 配置
 *
 * 避免在多個 service 中重複定義 getApiBase()
 * 優先順序：VITE_API_URL > VITE_API_HOST > 空字串（本地）
 */

const getApiBase = (): string => {
    const env = (import.meta as any).env;
    // 1. 完整 URL（最高優先）
    if (env?.VITE_API_URL && env.VITE_API_URL.startsWith('http')) {
        return env.VITE_API_URL;
    }
    // 2. 主機名（Render 部署用，自動加 HTTPS）
    if (env?.VITE_API_HOST) {
        return `https://${env.VITE_API_HOST}`;
    }
    // 3. 本地開發（相對路徑）
    return '';
};

export const API_BASE = getApiBase();
