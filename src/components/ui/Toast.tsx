/**
 * Toast.tsx
 *
 * 輕量級通知系統 — 不依賴額外套件。
 *
 * 使用：
 *   const { showToast } = useToast();
 *   showToast({ type: 'warning', message: '部分帳號同步失敗', detail: '...' });
 *
 * Provider 在 App.tsx 的最外層 render，這樣 showToast 全 app 可用。
 *
 * 設計取捨：
 *  - 不寫進 IndexedDB，所以重新整理就消失（這是設計，不是 bug）
 *  - 同類型 message 在 3 秒內重複 push 會被去重，避免 spam
 *  - info / warning / error 三層；error 比較久（8s），info 短（3s）
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastInput {
    type?: ToastType;
    message: string;
    detail?: string;
    /** 預設依 type：error 8s / warning 5s / info / success 3s */
    durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastInput, 'detail' | 'durationMs'>> {
    id: number;
    detail?: string;
    durationMs: number;
    createdAt: number;
}

interface ToastContextValue {
    showToast: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const defaultDuration = (type: ToastType): number => {
    switch (type) {
        case 'error': return 8000;
        case 'warning': return 5000;
        default: return 3000;
    }
};

let toastIdCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<ToastItem[]>([]);
    // 防 spam：同 message+type 在 3 秒內重複呼叫只顯示一次
    const recentRef = useRef<Map<string, number>>(new Map());

    const dismiss = useCallback((id: number) => {
        setItems(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((input: ToastInput) => {
        const type = input.type ?? 'info';
        const key = `${type}:${input.message}`;
        const now = Date.now();
        const last = recentRef.current.get(key) ?? 0;
        if (now - last < 3000) return;  // 去重
        recentRef.current.set(key, now);

        const id = ++toastIdCounter;
        const item: ToastItem = {
            id,
            type,
            message: input.message,
            detail: input.detail,
            durationMs: input.durationMs ?? defaultDuration(type),
            createdAt: now,
        };
        setItems(prev => [...prev, item]);

        // 自動消失
        window.setTimeout(() => dismiss(id), item.durationMs);
    }, [dismiss]);

    // 清除過期 dedup 紀錄（避免長時間運行記憶體緩慢膨脹）
    useEffect(() => {
        const timer = window.setInterval(() => {
            const now = Date.now();
            for (const [k, t] of recentRef.current.entries()) {
                if (now - t > 60000) recentRef.current.delete(k);
            }
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Stack：右上角固定，自下而上堆疊 */}
            <div
                aria-live="polite"
                className="fixed top-3 right-3 z-[100] flex flex-col gap-2 pointer-events-none"
                style={{ maxWidth: 'calc(100vw - 1.5rem)' }}
            >
                {items.map(t => (
                    <ToastCard key={t.id} item={t} onClose={() => dismiss(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastCard: React.FC<{ item: ToastItem; onClose: () => void }> = ({ item, onClose }) => {
    const styles = {
        info:    { Icon: Info,          ring: 'ring-blue-500/30',    bg: 'bg-blue-500/10',    text: 'text-blue-300'    },
        success: { Icon: CheckCircle2,  ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
        warning: { Icon: AlertTriangle, ring: 'ring-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-300'   },
        error:   { Icon: AlertCircle,   ring: 'ring-red-500/30',     bg: 'bg-red-500/10',     text: 'text-red-300'     },
    }[item.type];

    return (
        <div
            role="status"
            className={`pointer-events-auto flex gap-2.5 items-start min-w-[260px] max-w-[360px] px-3.5 py-2.5 rounded-xl border border-white/5 backdrop-blur-md ring-1 ${styles.ring} ${styles.bg} animate-in fade-in slide-in-from-right-2 duration-300`}
        >
            <styles.Icon size={16} className={`${styles.text} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-bold leading-snug ${styles.text}`}>{item.message}</p>
                {item.detail && (
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed break-words">{item.detail}</p>
                )}
            </div>
            <button
                onClick={onClose}
                className="shrink-0 p-0.5 rounded text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
            >
                <X size={12} />
            </button>
        </div>
    );
};

/** 在 ToastProvider 範圍內取得 showToast。在外面用會 throw。 */
export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast 必須在 <ToastProvider> 內呼叫');
    return ctx;
};

/**
 * 對非 React context 環境（utils、services）暴露一個 emit 函式。
 * Provider 掛載時 wire；未掛載時 emit 會 fallback 到 console.warn。
 *
 * 使用範例：
 *   import { emitToast } from '@/components/ui/Toast';
 *   emitToast({ type: 'warning', message: 'CA 即將到期' });
 */
let _externalEmit: ((t: ToastInput) => void) | null = null;
export const _registerExternalEmit = (fn: ((t: ToastInput) => void) | null) => {
    _externalEmit = fn;
};
export const emitToast = (t: ToastInput): void => {
    if (_externalEmit) {
        _externalEmit(t);
    } else {
        // ToastProvider 還沒掛載（早期啟動 / 測試環境）
        const level = t.type === 'error' ? 'error' : t.type === 'warning' ? 'warn' : 'log';
        // eslint-disable-next-line no-console
        console[level]('[toast fallback]', t.message, t.detail ?? '');
    }
};
