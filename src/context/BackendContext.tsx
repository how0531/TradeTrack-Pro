import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
    onBackendStatusChange,
    getBackendStatus,
    wakeUpBackendViaGateway,
    preemptiveWake,
    type BackendGatewayStatus,
} from '../services/backendGateway';

export type BackendStatus = 'checking' | 'online' | 'offline' | 'sleeping';

const gatewayToContext = (s: BackendGatewayStatus): BackendStatus => {
    if (s === 'online') return 'online';
    if (s === 'waking') return 'sleeping';
    if (s === 'offline') return 'offline';
    return 'checking'; // 'unknown'
};

interface BackendContextType {
    status: BackendStatus;
    wake: () => Promise<void>;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<BackendStatus>(() =>
        gatewayToContext(getBackendStatus())
    );
    const isWakingRef = useRef(false);

    // 訂閱 gateway 單一狀態來源，不再自行發 health check
    useEffect(() => {
        const unsub = onBackendStatusChange((s) => setStatus(gatewayToContext(s)));
        // App 載入時觸發 gateway 的 pre-emptive wake（已做 singleton 防重複）
        preemptiveWake();
        return () => { unsub(); };
    }, []);

    const wake = async () => {
        if (isWakingRef.current) return;
        isWakingRef.current = true;
        setStatus('sleeping');
        await wakeUpBackendViaGateway();
        isWakingRef.current = false;
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
