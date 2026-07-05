import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { I18N } from '../../constants';
import { Lang } from '../../types';
import { getLocalDateStr } from '../../utils/format';
import { safeDateParse } from '../../utils/calculations';

interface CustomDateRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (start: string | null, end: string | null) => void;
    initialRange: { start: string | null; end: string | null };
    lang: Lang;
}

/**
 * 自訂日期範圍選擇器
 * 使用自訂日曆 UI 取代原生 input[type=date]，
 * 解決跨平台（特別是手機瀏覽器）顯示不一致的問題。
 */
export const CustomDateRangeModal = ({ isOpen, onClose, onApply, initialRange, lang }: CustomDateRangeModalProps) => {
    const t = I18N[lang] || I18N['zh'];
    const [viewDate, setViewDate] = useState(new Date());
    const [startDate, setStartDate] = useState<string | null>(initialRange.start);
    const [endDate, setEndDate] = useState<string | null>(initialRange.end);
    const [step, setStep] = useState<'start' | 'end'>('start');
    const [editMode, setEditMode] = useState<'start' | 'end' | null>(null);
    const [tempInput, setTempInput] = useState('');

    // 開啟時初始化，並將月曆定位到起始日所在月份
    useEffect(() => {
        if (isOpen) {
            setStartDate(initialRange.start);
            setEndDate(initialRange.end);
            setStep('start');

            // 根據起始日定位月曆顯示月份
            if (initialRange.start) {
                const d = safeDateParse(initialRange.start);
                if (!isNaN(d.getTime())) {
                    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }
            } else {
                setViewDate(new Date());
            }
        }
    }, [isOpen, initialRange.start, initialRange.end]);

    if (!isOpen) return null;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

    // 統一的日期點擊處理
    const handleDateClick = (date: Date) => {
        const dateStr = getLocalDateStr(date);
        if (step === 'start') {
            setStartDate(dateStr);
            // 起始日超過結束日時，清除結束日
            if (endDate && dateStr > endDate) setEndDate(null);
            setStep('end');
        } else {
            if (startDate && dateStr < startDate) {
                // 結束日早於起始日 → 當作新的起始日
                setStartDate(dateStr);
                setEndDate(null);
                setStep('end');
            } else {
                setEndDate(dateStr);
                // 選完結束日後，停留在 end 步驟（方便微調）
            }
        }
    };

    // 點擊「今日」快捷按鈕
    const handleToday = (e: React.MouseEvent) => {
        e.stopPropagation();
        const today = getLocalDateStr(new Date());
        setEndDate(today);
        // 同時將月曆切到今天所在月份
        setViewDate(new Date());
    };

    const handleInputBlur = () => {
        const input = tempInput.trim();
        if (input === '') {
            if (editMode === 'start') setStartDate(null);
            if (editMode === 'end') setEndDate(null);
        } else {
            let normalized = input.replace(/\//g, '-').replace(/\./g, '-');
            // Support formats like 20260225
            if (normalized.length === 8 && !normalized.includes('-')) {
                normalized = `${normalized.substring(0, 4)}-${normalized.substring(4, 6)}-${normalized.substring(6, 8)}`;
            }
            const d = safeDateParse(normalized);
            if (!isNaN(d.getTime())) {
                const ds = getLocalDateStr(d);
                if (editMode === 'start') {
                    setStartDate(ds);
                    if (endDate && ds > endDate) setEndDate(null);
                    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                    setStep('end');
                } else if (editMode === 'end') {
                    if (startDate && ds < startDate) {
                        setStartDate(ds);
                        setEndDate(null);
                        setStep('end');
                    } else {
                        setEndDate(ds);
                    }
                    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
                }
            }
        }
        // Use setTimeout to prevent onBlur from blocking clicks on calendar buttons
        setTimeout(() => setEditMode(null), 150);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    // 友善的日期顯示格式 (2026/02/24)
    const formatDisplay = (dateStr: string | null): string => {
        if (!dateStr) return '—';
        const d = safeDateParse(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        const wd = weekDays[d.getDay()];
        return `${y}/${m}/${day} (${wd})`;
    };

    // 今天的日期字串（用於標記今日）
    const todayStr = getLocalDateStr(new Date());

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-[#141619] rounded-[32px] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-2">
                            <Calendar size={16} className="text-[#C8B085]" />
                            {t.selectDateRange}
                        </h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-slate-500 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* 日期顯示區域 — 加回輸入功能 */}
                    <div className="flex gap-3">
                        {/* Start Date Box */}
                        <div
                            onClick={() => {
                                setStep('start');
                                if (editMode !== 'start') {
                                    setEditMode('start');
                                    setTempInput(startDate ? startDate.replace(/-/g, '/') : '');
                                }
                            }}
                            className={`flex-1 p-3.5 rounded-2xl border transition-all cursor-text select-none ${step === 'start' ? 'border-[#C8B085] bg-[#C8B085]/5 shadow-[0_0_20px_rgba(200,176,133,0.05)]' : 'border-white/5 bg-black/40 hover:border-white/10'}`}
                        >
                            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1.5 block tracking-wider">{t.startDate}</label>
                            {editMode === 'start' ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={tempInput}
                                    onChange={(e) => setTempInput(e.target.value)}
                                    onBlur={handleInputBlur}
                                    onKeyDown={handleKeyDown}
                                    placeholder="YYYY/MM/DD"
                                    className="w-full bg-transparent text-sm font-barlow-numeric font-bold tracking-wide text-white outline-none placeholder:text-zinc-700"
                                />
                            ) : (
                                <div className={`text-sm font-barlow-numeric font-bold tracking-wide ${startDate ? 'text-white' : 'text-zinc-700'}`}>
                                    {formatDisplay(startDate)}
                                </div>
                            )}
                        </div>

                        {/* End Date Box */}
                        <div
                            onClick={() => {
                                setStep('end');
                                if (editMode !== 'end') {
                                    setEditMode('end');
                                    setTempInput(endDate ? endDate.replace(/-/g, '/') : '');
                                }
                            }}
                            className={`flex-1 p-3.5 rounded-2xl border transition-all cursor-text select-none relative ${step === 'end' ? 'border-[#C8B085] bg-[#C8B085]/5 shadow-[0_0_20px_rgba(200,176,133,0.05)]' : 'border-white/5 bg-black/40 hover:border-white/10'}`}
                        >
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{t.endDate}</label>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleToday(e); }}
                                    className="text-[9px] font-bold text-[#C8B085] hover:underline px-1.5 py-0.5 rounded-md hover:bg-[#C8B085]/10 transition-colors"
                                >
                                    今日
                                </button>
                            </div>
                            {editMode === 'end' ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={tempInput}
                                    onChange={(e) => setTempInput(e.target.value)}
                                    onBlur={handleInputBlur}
                                    onKeyDown={handleKeyDown}
                                    placeholder="YYYY/MM/DD"
                                    className="w-full bg-transparent text-sm font-barlow-numeric font-bold tracking-wide text-white outline-none placeholder:text-zinc-700"
                                />
                            ) : (
                                <div className={`text-sm font-barlow-numeric font-bold tracking-wide ${endDate ? 'text-white' : 'text-zinc-700'}`}>
                                    {formatDisplay(endDate)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Calendar Body */}
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"><ChevronLeft size={20} /></button>
                        <span className="font-bold text-white text-sm tracking-widest">{year} / {month + 1}</span>
                        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"><ChevronRight size={20} /></button>
                    </div>

                    <div className="grid grid-cols-7 text-center mb-3">
                        {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
                            <div key={i} className="text-[10px] font-bold text-zinc-700 tracking-tighter">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-0">
                        {days.map((d, i) => {
                            const dateStr = d ? getLocalDateStr(d) : '';
                            const isStart = dateStr === startDate;
                            const isEnd = dateStr === endDate;
                            const isSel = isStart || isEnd;
                            const isToday = dateStr === todayStr;
                            const dInRange = d && startDate && endDate && dateStr > startDate && dateStr < endDate;
                            // 起始日與結束日相同時不顯示 range 背景
                            const isSameDay = startDate && endDate && startDate === endDate;

                            return (
                                <div key={i} className="relative flex justify-center items-center h-10">
                                    {/* Range Background - Seamless */}
                                    {dInRange && (
                                        <div className="absolute inset-y-1.5 inset-x-0 bg-[#C8B085]/15 z-0" />
                                    )}
                                    {isStart && endDate && !isSameDay && (
                                        <div className="absolute inset-y-1.5 right-0 left-1/2 bg-[#C8B085]/15 z-0 rounded-l-md" />
                                    )}
                                    {isEnd && startDate && !isSameDay && (
                                        <div className="absolute inset-y-1.5 left-0 right-1/2 bg-[#C8B085]/15 z-0 rounded-r-md" />
                                    )}

                                    <button
                                        onClick={() => d && handleDateClick(d)}
                                        className={`
                                            relative w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-barlow-numeric font-bold z-10 transition-all
                                            ${!d ? 'invisible' : ''} 
                                            ${isSel ? 'bg-[#C8B085] text-black shadow-lg shadow-[#C8B085]/40 scale-105' :
                                                dInRange ? 'text-[#C8B085] hover:bg-[#C8B085]/20' :
                                                    isToday ? 'text-[#C8B085] ring-1 ring-[#C8B085]/30 hover:bg-[#C8B085]/10' :
                                                        'text-zinc-500 hover:text-white hover:bg-white/5'}
                                        `}
                                    >
                                        {d ? d.getDate() : ''}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex items-center justify-between bg-white/[0.01]">
                    <button
                        onClick={() => { setStartDate(null); setEndDate(null); setStep('start'); }}
                        className="text-[10px] font-bold uppercase text-zinc-600 hover:text-zinc-300 transition-colors tracking-widest"
                    >
                        {t.reset}
                    </button>
                    {/* L5 (v3.9.0): 確認鈕加 start<=end guard。「今日」快捷鈕只設
                        endDate 不驗證順序，可產生 start>end 的區間 → 套用後所有
                        統計歸零且使用者不知道為什麼。 */}
                    {(() => {
                        const rangeValid = !!startDate && !!endDate && startDate <= endDate;
                        return (
                            <button
                                onClick={() => rangeValid && onApply(startDate, endDate)}
                                disabled={!rangeValid}
                                className={`
                                    px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all
                                    ${rangeValid ? 'bg-[#C8B085] text-black shadow-[0_8px_16px_rgba(200,176,133,0.3)] hover:scale-[1.02] active:scale-95' : 'bg-[#25282C] text-zinc-700 cursor-not-allowed'}
                                `}
                            >
                                {startDate && endDate && startDate > endDate
                                    ? (lang === 'zh' ? '起訖顛倒' : 'Invalid range')
                                    : t.confirm}
                            </button>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};