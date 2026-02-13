import React from 'react';
import { X, ChevronRight, AlertTriangle, Shield, Key, Lock, Globe, ExternalLink } from 'lucide-react';
import loginStepImg from '../../../assets/guide/login_step.png';
import apiMgmtStepImg from '../../../assets/guide/api_mgmt_step.png';
import createKeyStepImg from '../../../assets/guide/create_key_step.png';
import saveSecretStepImg from '../../../assets/guide/save_secret_step.png';

interface BrokerGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: 'zh' | 'en';
}

export const BrokerGuideModal = ({ isOpen, onClose, lang }: BrokerGuideModalProps) => {
    if (!isOpen) return null;

    const steps = [
        {
            title: "登入永豐金證券",
            desc: "請前往永豐金證券官網並登入您的帳戶 (需完成雙因子驗證)。",
            image: loginStepImg,
            icon: <Globe size={20} className="text-blue-400" />,
            warning: false
        },
        {
            title: "進入 API 管理",
            desc: "在會員服務選單中找到【API 管理】，點擊【新增 API Key】並完成驗證。",
            image: apiMgmtStepImg,
            icon: <Key size={20} className="text-amber-400" />,
            warning: false
        },
        {
            title: "輸入 API 資訊",
            desc: "填寫【新增 API 資訊】，務必至少勾選【帳務】及【交易】權限，並選擇正確的券商帳戶。",
            image: createKeyStepImg,
            icon: <Shield size={20} className="text-emerald-400" />,
            warning: false
        },
        {
            title: "保存金鑰 (重要)",
            desc: "務必妥善保存 API Key 與 Secret Key 後才能離開畫面！",
            subDesc: "Secret Key 只會顯示一次，若遺失需重新申請。",
            image: saveSecretStepImg,
            icon: <Lock size={20} className="text-red-500" />,
            warning: true
        }
    ];

    return (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            {/* Modal Container */}
            <div className="w-full max-w-4xl bg-[#1C1E22] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#C8B085]/10 flex items-center justify-center">
                            <Key size={20} className="text-[#C8B085]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">API Key 取得指引</h3>
                            <p className="text-xs text-zinc-500 font-mono">Shioaji API Setup Guide</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar">

                    {/* Intro Alert */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 md:p-4 flex gap-3 text-amber-500">
                        <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                        <div className="text-xs font-bold leading-relaxed">
                            請依照以下步驟申請 API Key。API Key 與 Secret Key 是程式交易的核心憑證，請勿洩漏給他人。
                        </div>
                    </div>

                    {/* Steps Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {steps.map((step, idx) => (
                            <div key={idx} className={`group relative rounded-2xl border ${step.warning
                                ? 'border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.15)] ring-1 ring-red-500/20'
                                : 'border-white/5 bg-zinc-900/30'
                                } overflow-hidden hover:border-[#C8B085]/30 transition-all duration-300`}>
                                {/* Step Number */}
                                <div className={`absolute top-0 right-0 p-4 font-black text-6xl select-none pointer-events-none ${step.warning ? 'opacity-20 text-red-500' : 'opacity-10 text-white'}`}>
                                    {idx + 1}
                                </div>

                                <div className="p-4 md:p-5 flex flex-col h-full gap-3 md:gap-4">
                                    {/* Content Header */}
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={`w-8 h-8 rounded-lg ${step.warning ? 'bg-red-500/20' : 'bg-white/5'} flex items-center justify-center shrink-0`}>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-bold ${step.warning ? 'text-red-400' : 'text-zinc-200'}`}>
                                                {step.title}
                                            </h4>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="relative z-10">
                                        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                                            {step.desc}
                                        </p>
                                        {step.subDesc && (
                                            <p className="text-[10px] text-red-400 mt-1 font-bold animate-pulse">
                                                {step.subDesc}
                                            </p>
                                        )}
                                    </div>

                                    {/* Image Area - Clean & Natural */}
                                    <div className="mt-2 flex-1 relative rounded-xl overflow-hidden transition-all flex items-center justify-center">
                                        <img
                                            src={step.image}
                                            alt={step.title}
                                            className="w-full h-auto max-h-[250px] md:max-h-none object-contain rounded-lg shadow-lg border border-white/10"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                target.nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                        {/* Fallback Placeholder (Hidden by default unless error) */}
                                        <div className="hidden absolute inset-0 flex flex-col items-center justify-center gap-2 min-h-[150px] bg-black/20 rounded-lg">
                                            <div className="opacity-20 scale-150">
                                                {step.icon}
                                            </div>
                                            <span className="text-[10px] font-mono opacity-40">IMAGE NOT FOUND</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Action */}
                    <div className="flex justify-center pt-2 md:pt-4 pb-2">
                        <a
                            href="https://www.sinotrade.com.tw/newweb/PythonAPIKey/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C8B085] hover:bg-[#E0C8A0] text-black font-bold text-sm shadow-[0_0_20px_rgba(200,176,133,0.2)] transition-all transform hover:scale-105 active:scale-95"
                        >
                            <ExternalLink size={16} />
                            永豐金API管理中心
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
