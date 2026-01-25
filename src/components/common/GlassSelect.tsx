
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface GlassSelectProps {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    variant?: 'capsule' | 'standard';
    className?: string;
    align?: 'left' | 'right';
}

export const GlassSelect: React.FC<GlassSelectProps> = ({ 
    value, 
    onChange, 
    options, 
    placeholder = "Select...", 
    variant = 'standard',
    className = '',
    align = 'right'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current && 
                !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current && 
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUpwards = spaceBelow < 220;

            setPosition({
                top: openUpwards ? rect.top - 8 : rect.bottom + 8,
                left: align === 'right' ? rect.right : rect.left,
                width: Math.max(rect.width, 140)
            });
        }
    }, [isOpen, align]);

    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between gap-1 transition-all outline-none group
                    ${variant === 'capsule' 
                        ? 'rounded-full bg-white/5 border border-white/10 hover:bg-white/10 px-1.5 py-1' 
                        : 'rounded-lg bg-[#1C1E22]/35 border border-white/10 hover:bg-white/5 px-2 py-1.5'
                    }
                    ${isOpen ? 'border-white/30 bg-white/10' : ''}
                `}
            >
                <span className={`text-[10px] font-bold truncate flex-1 text-left ${variant === 'capsule' ? 'text-slate-300' : 'text-white'}`}>
                    {selectedLabel}
                </span>
                <ChevronDown size={8} className={`text-zinc-600 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div 
                    ref={dropdownRef}
                    style={{ 
                        top: position.top, 
                        left: align === 'right' ? undefined : position.left,
                        right: align === 'right' ? (window.innerWidth - position.left) : undefined,
                        minWidth: position.width,
                        transform: position.top > (containerRef.current?.getBoundingClientRect().top || 0) ? 'translateY(0)' : 'translateY(-100%)'
                    }}
                    className={`
                        fixed max-h-[200px] overflow-y-auto 
                        bg-[#0C0D0F]/95 backdrop-blur-2xl
                        border border-white/10 rounded-xl 
                        shadow-[0_20px_40px_rgba(0,0,0,0.9)] ring-1 ring-white/10
                        z-[99999] custom-scrollbar 
                        animate-in fade-in zoom-in-95 duration-200
                    `}
                >
                    <div className="p-1.5 space-y-0.5">
                        {options.map(opt => (
                            <div
                                key={opt.value}
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    onChange(opt.value); 
                                    setIsOpen(false); 
                                }}
                                className={`
                                    px-3 py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-colors truncate flex items-center justify-between
                                    ${opt.value === value ? 'bg-[#C8B085]/20 text-[#C8B085]' : 'text-slate-300 hover:bg-white/10 hover:text-white'}
                                `}
                            >
                                {opt.label}
                                {opt.value === value && <Check size={10} />}
                            </div>
                        ))}
                    </div>
                </div>
            , document.body)}
        </div>
    );
};
