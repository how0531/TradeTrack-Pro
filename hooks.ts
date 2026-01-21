import { useState, useEffect, useMemo, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
  setPersistence, browserLocalPersistence, GoogleAuthProvider, OAuthProvider, signInWithPopup, signOut, User as FirebaseUser 
} from 'firebase/auth';
import { Trade, Portfolio, User, Lang, Frequency, TimeRange, Metrics } from './types';
import { safeJSONParse, calculateMetrics, calculateStreaks, downloadCSV, getLocalDateStr } from './utils';
import { DEFAULT_PALETTE, THEME, I18N } from './constants';

// --- Local Storage Hook ---
export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => safeJSONParse(key, initialValue));
    
    const setValue = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue] as const;
}

// --- Auth Hook ---
export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
    const [db, setDb] = useState<any>(null);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            try {
                // @ts-ignore
                const confStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
                // @ts-ignore
                const aid = typeof __app_id !== 'undefined' ? __app_id : 'local';
                
                if (!confStr) {
                   if(isMounted) setStatus('offline');
                   return;
                }
                
                const firebaseApp = firebase.apps.length === 0 ? firebase.initializeApp(JSON.parse(confStr)) : firebase.app();
                const _auth = getAuth(firebaseApp as any);
                const _db = firebaseApp.firestore();
                
                if(isMounted) { setDb(_db); setConfig({ appId: aid }); }
                await setPersistence(_auth, browserLocalPersistence);
                
                // @ts-ignore
                const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                
                onAuthStateChanged(_auth, (u) => {
                    if(!isMounted) return;
                    if (u) { 
                        setUser({ 
                            uid: u.uid, 
                            isAnonymous: u.isAnonymous, 
                            displayName: u.displayName, 
                            email: u.email,
                            photoURL: u.photoURL 
                        });
                        setStatus('online'); 
                    } else { 
                        if (token) signInWithCustomToken(_auth, token).catch(() => signInAnonymously(_auth));
                        else signInAnonymously(_auth).catch(() => { if(isMounted) setStatus('offline'); });
                        setUser(null);
                        if(isMounted) setStatus('offline'); 
                    }
                });
            } catch (e) {
                if(isMounted) setStatus('offline');
            }
        };
        init();
        const timer = setTimeout(() => { if (isMounted && status === 'loading') { setStatus('offline'); } }, 3500);
        return () => { isMounted = false; clearTimeout(timer); };
    }, []);

    const login = async (providerType: 'google' | 'apple') => {
        try {
            const auth = getAuth();
            let provider;
            if (providerType === 'google') {
                provider = new GoogleAuthProvider();
            } else {
                provider = new OAuthProvider('apple.com');
                provider.addScope('email');
                provider.addScope('name');
            }
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error(`${providerType} Login failed`, error);
        }
    };

    const logout = async () => {
        try {
            await signOut(getAuth());
            window.location.reload();
        } catch (error) { console.error(error); }
    };

    return { user, status, db, config, login, logout };
};

// --- Data Hook ---
export const useTradeData = (user: User | null, status: string, db: any, config: any) => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [strategies, setStrategies] = useState<string[]>(() => safeJSONParse('local_strategies', ['突破策略', '回檔承接']));
    const [emotions, setEmotions] = useState<string[]>(() => safeJSONParse('local_emotions', ['冷靜', 'FOMO', '復仇單']));
    
    const [portfolios, setPortfolios] = useState<Portfolio[]>(() => {
        const saved = safeJSONParse<any[]>('local_portfolios', []);
        if (saved.length === 0) {
            return [{ id: 'main', name: 'Main Account', initialCapital: 100000, profitColor: DEFAULT_PALETTE[0], lossColor: THEME.DEFAULT_LOSS }];
        }
        // 相容性：將舊的 color 屬性轉換
        return saved.map(p => ({
            ...p,
            profitColor: p.profitColor || p.color || DEFAULT_PALETTE[0],
            lossColor: p.lossColor || THEME.DEFAULT_LOSS
        }));
    });

    const [activePortfolioIds, setActivePortfolioIds] = useLocalStorage<string[]>('app_active_portfolios', ['main']);
    const [lossColor, setLossColor] = useLocalStorage<string>('app_loss_color', THEME.DEFAULT_LOSS);
    const [isSyncing, setIsSyncing] = useState(false);

    const migrateLocalToCloud = useCallback(async (currentTrades: Trade[]) => {
        if (!db || !user || !config || currentTrades.length === 0) return;
        setIsSyncing(true);
        try {
            const batch = db.batch();
            const colRef = db.collection(`artifacts/${config.appId}/users/${user.uid}/trade_journal`);
            currentTrades.forEach(tr => {
                const { id, ...data } = tr;
                const newDocRef = colRef.doc();
                batch.set(newDocRef, { ...data, timestamp: data.timestamp || new Date().toISOString() });
            });
            const settingsRef = db.doc(`artifacts/${config.appId}/users/${user.uid}/app_config/settings`);
            batch.set(settingsRef, { strategies, emotions, portfolios, lossColor }, { merge: true });
            await batch.commit();
            localStorage.removeItem('local_trades');
        } catch (error) {
            console.error("Migration failed", error);
        } finally {
            setIsSyncing(false);
        }
    }, [db, user, config, strategies, emotions, portfolios, lossColor]);

    useEffect(() => {
        if (status !== 'online' || !db || !user || !config) {
            if(status === 'offline') setTrades(safeJSONParse('local_trades', []));
            return;
        }

        const localTrades = safeJSONParse<Trade[]>('local_trades', []);
        if (localTrades.length > 0 && !user.isAnonymous) {
            const lang = (localStorage.getItem('app_lang') || 'zh').replace(/"/g, '') as Lang;
            if (window.confirm(I18N[lang].migrateConfirm)) migrateLocalToCloud(localTrades);
        }

        const tradesRef = db.collection(`artifacts/${config.appId}/users/${user.uid}/trade_journal`);
        const unsubTrades = tradesRef.onSnapshot((snap: any) => {
            setTrades(snap.docs.map((d: any) => ({ id: d.id, ...d.data(), pnl: Number(d.data().pnl || 0) } as Trade)));
        });
        
        const configRef = db.doc(`artifacts/${config.appId}/users/${user.uid}/app_config/settings`);
        const unsubConfig = configRef.onSnapshot((snap: any) => { 
            if (snap.exists) {
                const data = snap.data();
                if(data.strategies) setStrategies(data.strategies);
                if(data.emotions) setEmotions(data.emotions);
                if(data.portfolios) {
                    const mappedPortfolios = data.portfolios.map((p: any) => ({
                        ...p,
                        profitColor: p.profitColor || p.color || DEFAULT_PALETTE[0],
                        lossColor: p.lossColor || THEME.DEFAULT_LOSS
                    }));
                    setPortfolios(mappedPortfolios);
                }
                if(data.lossColor) setLossColor(data.lossColor);
            }
        });

        return () => { unsubTrades(); unsubConfig(); };
    }, [status, user, db, config, migrateLocalToCloud]);

    const actions = useMemo(() => ({
        saveTrade: async (tradeData: Trade, id: string | null) => {
            const pid = tradeData.portfolioId || activePortfolioIds[0] || 'main';
            const dataToSave = { ...tradeData, portfolioId: pid };
            if (status === 'offline' || (user && user.isAnonymous)) {
                setTrades(prev => {
                    const next = id ? prev.map(t => t.id === id ? { ...dataToSave, id } : t) : [...prev, { ...dataToSave, id: Date.now().toString() }];
                    localStorage.setItem('local_trades', JSON.stringify(next));
                    return next;
                });
            } 
            if (status === 'online' && db && user) {
                const colRef = db.collection(`artifacts/${config.appId}/users/${user.uid}/trade_journal`);
                if (id) await colRef.doc(id).update(dataToSave); 
                else await colRef.add({ ...dataToSave, timestamp: new Date().toISOString() });
            }
        },
        deleteTrade: async (id: string) => {
            if (status === 'offline' || (user && user.isAnonymous)) {
                setTrades(prev => { const next = prev.filter(t => t.id !== id); localStorage.setItem('local_trades', JSON.stringify(next)); return next; });
            } 
            if (status === 'online' && db && user) await db.collection(`artifacts/${config.appId}/users/${user.uid}/trade_journal`).doc(id).delete();
        },
        updateSettings: async (field: string, value: any) => {
            if (field === 'strategies') setStrategies(value); 
            else if (field === 'emotions') setEmotions(value); 
            else if (field === 'portfolios') setPortfolios(value); 
            else if (field === 'lossColor') setLossColor(value);
            localStorage.setItem(`local_${field}`, JSON.stringify(value));
            if (status === 'online' && db && user) {
                await db.doc(`artifacts/${config.appId}/users/${user.uid}/app_config/settings`).set({ [field]: value }, { merge: true });
            }
        },
        updatePortfolio: (id: string, field: string, value: any) => {
            const updated = portfolios.map(p => p.id === id ? { ...p, [field]: (field === 'initialCapital' ? (parseFloat(value) || 0) : value) } : p);
            actions.updateSettings('portfolios', updated);
        },
        addStrategy: (s: string) => { if(s && !strategies.includes(s)) actions.updateSettings('strategies', [...strategies, s]); },
        deleteStrategy: (s: string) => actions.updateSettings('strategies', strategies.filter(i => i !== s)),
        addEmotion: (e: string) => { if(e && !emotions.includes(e)) actions.updateSettings('emotions', [...emotions, e]); },
        deleteEmotion: (e: string) => actions.updateSettings('emotions', emotions.filter(i => i !== e)),
        handleImportCSV: (e: any, t: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const lines = (event.target?.result as string).split('\n');
                const newTrades: any[] = [];
                const targetPid = activePortfolioIds[0] || 'main';
                for(let i=1; i<lines.length; i++) {
                    const cols = lines[i].split(','); 
                    if(cols.length < 5) continue;
                    newTrades.push({ 
                        date: cols[1], pnl: parseFloat(cols[4]), 
                        strategy: cols[5]?.replace(/"/g, ''), emotion: cols[6]?.replace(/"/g, ''), 
                        note: cols[7]?.replace(/"/g, ''), portfolioId: targetPid 
                    });
                }
                if (status === 'offline' || (user && user.isAnonymous)) {
                    setTrades(prev => { const next = [...prev, ...newTrades.map(t => ({...t, id: Math.random().toString()}))]; localStorage.setItem('local_trades', JSON.stringify(next)); return next; });
                }
                if (status === 'online' && db && user) {
                    const batch = db.batch();
                    const colRef = db.collection(`artifacts/${config.appId}/users/${user.uid}/trade_journal`);
                    newTrades.forEach(tr => batch.set(colRef.doc(), tr));
                    await batch.commit();
                }
                alert(t.importSuccess);
            };
            reader.readAsText(file);
        },
        downloadCSV
    }), [status, db, user, config, portfolios, activePortfolioIds, strategies, emotions]);

    return { 
        trades, strategies, emotions, portfolios, 
        activePortfolioIds, setActivePortfolioIds, 
        lossColor, setLossColor,
        isSyncing,
        actions 
    };
};

// --- Metrics Hook ---
export const useMetrics = (
    trades: Trade[], 
    portfolios: Portfolio[], 
    activePortfolioIds: string[], 
    frequency: Frequency, 
    lang: Lang,
    customRange: { start: string | null, end: string | null },
    filterStrategy: string[],
    filterEmotion: string[]
) => {
    const portfolioTrades = useMemo(() => trades.filter(t => activePortfolioIds.includes(t.portfolioId || 'main')), [trades, activePortfolioIds]);
    const filteredTrades = useMemo(() => {
        let res = portfolioTrades;
        if (filterStrategy.length) res = res.filter(t => filterStrategy.includes(t.strategy || ''));
        if (filterEmotion.length) res = res.filter(t => filterEmotion.includes(t.emotion || ''));
        return res;
    }, [portfolioTrades, filterStrategy, filterEmotion]);
    const metrics = useMemo(() => calculateMetrics(
        filteredTrades, portfolios, activePortfolioIds, frequency, lang, 
        customRange.start ? new Date(customRange.start) : null, 
        customRange.end ? new Date(customRange.end) : null
    ), [filteredTrades, portfolios, activePortfolioIds, frequency, lang, customRange]);
    const streaks = useMemo(() => calculateStreaks(filteredTrades), [filteredTrades]);
    const dailyPnlMap = useMemo(() => filteredTrades.reduce((acc: any, t) => { acc[t.date] = (acc[t.date] || 0) + (Number(t.pnl) || 0); return acc; }, {}), [filteredTrades]);
    return { filteredTrades, metrics, streaks, dailyPnlMap };
};