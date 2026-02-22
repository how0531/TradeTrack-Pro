
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { I18N } from '../constants';
import { Lang } from '../types';

interface NavigationBarProps {
    lang: Lang;
    onFabClick: () => void;
}

export const NavigationBar: React.FC<NavigationBarProps> = ({ lang, onFabClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const t = I18N[lang] || I18N['zh'];

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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-[350px] pointer-events-none h-16">
            {/* 1. VISUAL BACKGROUND LAYER (WITH CUTOUT) */}
            <div
                className="absolute inset-0 glass-panel rounded-full shadow-2xl ring-1 ring-white/5"
                style={{
                    WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent 28px, black 28.5px)',
                    maskImage: 'radial-gradient(circle at 50% 50%, transparent 28px, black 28.5px)'
                }}
            />

            {/* 2. INTERACTION LAYER */}
            <div className="relative h-full w-full pointer-events-auto flex items-center justify-between px-3">

                {/* Left Group */}
                <div className="flex items-center gap-1 h-full py-2">
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
                                    relative w-16 h-full rounded-2xl transition-all duration-500 group flex flex-col items-center justify-center overflow-hidden
                                    ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                                `}
                            >
                                <span className={`text-xs font-bold uppercase tracking-wider block transition-all duration-300 relative z-10 ${isActive ? 'text-[#C8B085] scale-110' : 'text-slate-500 group-hover:text-slate-300'}`}>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* CENTRAL FLOATING BUTTON */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[64px] h-[64px] rounded-full z-20 pointer-events-auto transition-all group overflow-hidden shadow-[0_8px_32px_rgba(200,176,133,0.3)] hover:scale-105 active:scale-95">
                    <button
                        onClick={onFabClick}
                        className="w-full h-full flex items-center justify-center text-[#C8B085] relative z-10 bg-[#C8B085]/20 backdrop-blur-xl border border-[#C8B085]/40 rounded-full"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50 rounded-full"></div>
                        <Plus size={32} strokeWidth={2.5} className="transition-transform duration-300 group-hover:rotate-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-20" />
                    </button>
                </div>

                {/* Right Group */}
                <div className="flex items-center gap-1 h-full py-2">
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
                                    relative w-16 h-full rounded-2xl transition-all duration-500 group flex flex-col items-center justify-center overflow-hidden
                                    ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                                `}
                            >
                                <span className={`text-xs font-bold uppercase tracking-wider block transition-all duration-300 relative z-10 ${isActive ? 'text-[#C8B085] scale-110' : 'text-slate-500 group-hover:text-slate-300'}`}>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
