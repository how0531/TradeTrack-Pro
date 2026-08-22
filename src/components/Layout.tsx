
import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { I18N } from '../constants';
import { Lang } from '../types';
import { useTradeContext } from '../context/TradeContext';

interface LayoutProps {
    lang: Lang;
    onFabClick: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ lang, onFabClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const t = I18N[lang] || I18N['zh'];
    const { hideAmounts, setHideAmounts } = useTradeContext();

    const getActiveTab = () => {
        const path = location.pathname;
        if (path === '/') return 'stats';
        if (path.startsWith('/journal')) return 'calendar';
        if (path.startsWith('/logs')) return 'logs';
        if (path.startsWith('/settings')) return 'settings';
        return 'stats';
    };

    const activeTab = getActiveTab();

    return (
        <div className="flex-1 flex flex-col relative w-full h-full overflow-x-hidden">
            {/* Page Content */}
            <div className="flex-1 relative w-full">
                <Outlet />
            </div>

            {/* Persistent Privacy Blur toggle — available on every route so
                the user can mask amounts before a screenshot without hunting
                through a menu. Pinned top-right, tucked away from primary nav. */}
            <button
                onClick={() => setHideAmounts(!hideAmounts)}
                aria-label={lang === 'zh' ? (hideAmounts ? '顯示金額' : '隱藏金額') : (hideAmounts ? 'Show amounts' : 'Hide amounts')}
                title={lang === 'zh' ? (hideAmounts ? '顯示金額' : '隱藏金額（截圖友善）') : (hideAmounts ? 'Show amounts' : 'Hide amounts (screenshot-friendly)')}
                // top 用 env(safe-area-inset-top)：PWA viewport-fit=cover 時內容會延伸到
                // iOS 狀態列下，固定 top-3 會壓在時鐘／動態島底下（比照 DashboardHeader 做法）
                style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
                className={`fixed right-3 z-40 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-xl border transition-colors ${
                    hideAmounts
                        ? 'bg-[#C8B085]/20 border-[#C8B085]/40 text-[#C8B085]'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
            >
                {hideAmounts ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>

            {/* PREMIUM FLOATING NAVIGATION BAR */}
            {/* bottom 用 env(safe-area-inset-bottom)：避免壓到 iOS home indicator */}
            <div
                className="fixed left-1/2 -translate-x-1/2 z-50 w-[calc(100%-48px)] max-w-[350px] pointer-events-none h-16"
                style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            >
                {/* 1. VISUAL BACKGROUND LAYER (WITH CUTOUT) */}
                <div 
                    className="absolute inset-0 bg-white/5 backdrop-blur-3xl border border-white/20 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                    style={{
                        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 32px, black 32.5px)',
                        maskImage: 'radial-gradient(circle at 50% 50%, transparent 32px, black 32.5px)'
                    }}
                />

                {/* 2. INTERACTION LAYER */}
                <div className="relative h-full w-full pointer-events-auto flex items-center justify-between px-2">
                    
                    {/* Left Group */}
                    <div className="flex items-center h-full py-2">
                        {[
                            { id: 'stats', label: t.stats, path: '/' }, 
                            { id: 'calendar', label: t.journal, path: '/journal' }
                        ].map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button 
                                    key={tab.id} 
                                    onClick={() => navigate(tab.path)} 
                                    className={`
                                        relative w-[68px] h-full rounded-2xl transition-all duration-500 group flex flex-col items-center justify-center overflow-hidden
                                        ${isActive ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}
                                    `}
                                >
                                    {isActive && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gradient-to-r from-transparent via-[#C8B085] to-transparent shadow-[0_2px_12px_#C8B085]" />
                                    )}
                                    <span className={`text-[10px] font-bold uppercase tracking-wider block transition-all duration-300 relative z-10 ${isActive ? 'text-[#C8B085] translate-y-0.5' : 'text-slate-500 group-hover:text-slate-300'}`}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* CENTRAL FLOATING BUTTON */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full z-20 pointer-events-auto transition-all duration-300 group overflow-hidden shadow-[0_8px_32px_rgba(200,176,133,0.3)] hover:scale-105 active:scale-95 hover:shadow-[0_12px_40px_rgba(200,176,133,0.4)]">
                        <button 
                            onClick={onFabClick} 
                            className="w-full h-full flex items-center justify-center text-[#C8B085] relative z-10 bg-[#C8B085]/20 backdrop-blur-3xl border border-[#C8B085]/40 rounded-full"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50 rounded-full"></div>
                            <Plus size={30} strokeWidth={2.5} className="transition-transform duration-300 group-hover:rotate-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-20" />
                        </button>
                    </div>

                    {/* Right Group */}
                    <div className="flex items-center h-full py-2">
                        {[
                            { id: 'logs', label: t.logs, path: '/logs' }, 
                            { id: 'settings', label: t.settings, path: '/settings' }
                        ].map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button 
                                    key={tab.id} 
                                    onClick={() => navigate(tab.path)} 
                                    className={`
                                        relative w-[68px] h-full rounded-2xl transition-all duration-500 group flex flex-col items-center justify-center overflow-hidden
                                        ${isActive ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}
                                    `}
                                >
                                    {isActive && (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gradient-to-r from-transparent via-[#C8B085] to-transparent shadow-[0_2px_12px_#C8B085]" />
                                    )}
                                    <span className={`text-[10px] font-bold uppercase tracking-wider block transition-all duration-300 relative z-10 ${isActive ? 'text-[#C8B085] translate-y-0.5' : 'text-slate-500 group-hover:text-slate-300'}`}>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
