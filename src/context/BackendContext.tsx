import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { validateBackendStatus, wakeUpBackend } from '../services/brokerService';

export type BackendStatus = 'checking' | 'online' | 'offline' | 'sleeping';

interface BackendContextType {
    status: BackendStatus;
    wake: () => Promise<void>;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<BackendStatus>('checking');
    const isWakingRef = useRef(false);

    const checkAndWake = async () => {
        if (isWakingRef.current) return;
        
        // 初始狀態檢查
        const currentStatus = await validateBackendStatus(0); // 嘗試 0 次重試，加快初始判定
        
        if (currentStatus === 'sleeping') {
            setStatus('sleeping');
            isWakingRef.current = true;
            // 進入漸進式喚醒輪詢階段
            const wakeResult = await wakeUpBackend();
            setStatus(wakeResult.success ? 'online' : 'offline');
            isWakingRef.current = false;
        } else {
            setStatus(currentStatus === 'ready' ? 'online' : currentStatus);
        }
    };

    // 背景提早啟動：無論使用者有沒有點擊，只要 App 載入就先觸發檢測與喚醒，消滅等待時間
    useEffect(() => {
        checkAndWake();
    }, []);

    // 當狀態並非 online 且沒有正在喚醒時，每 30 秒定期檢測一次
    useEffect(() => {
        const interval = setInterval(() => {
            if (status !== 'online' && !isWakingRef.current) {
                checkAndWake();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, [status]);

    const wake = async () => {
        // 提供手動觸發的介面給 UI
        setStatus('checking');
        await checkAndWake();
    };

    return (
        <BackendContext.Provider value={{ status, wake }}>
            {children}
        </BackendContext.Provider>
    );
};

export const useBackend = () => {
    const context = useContext(BackendContext);
    if (!context) throw new Error('useBackend must be used within BackendProvider');
    return context;
};
