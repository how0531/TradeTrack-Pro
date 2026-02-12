/**
 * Stock Name Lookup Service (3-Tier Robust)
 * 
 * Layer 1: Local STOCK_NAME_MAP (instant, offline)
 * Layer 2: localStorage cache (instant, offline, grows over time)
 * Layer 3: TWSE ISIN online query (1-2s, requires network)
 * 
 * Backend is NOT required. L3 tries backend proxy first, then CORS proxy fallback.
 */

import { STOCK_NAME_MAP } from '../utils/stockMap';

// --- Constants ---
const CACHE_KEY = 'stock_name_cache_v1';
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// API Base (reuse from env)
const getApiBase = () => {
    const env = (import.meta as any).env;
    if (env?.VITE_API_URL && env.VITE_API_URL.startsWith('http')) return env.VITE_API_URL;
    if (env?.VITE_API_HOST) return `https://${env.VITE_API_HOST}`;
    return '';
};
const API_BASE = getApiBase();

// --- Types ---
export interface StockInfo {
    code: string;
    name: string;
}

interface CacheEntry {
    name: string;
    ts: number; // timestamp
}

// --- Layer 2: Cache Helpers ---
const getCache = (): Record<string, CacheEntry> => {
    try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    } catch {
        return {};
    }
};

const setCacheEntry = (code: string, name: string) => {
    try {
        const cache = getCache();
        cache[code] = { name, ts: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch { /* quota exceeded, silent */ }
};

const getCacheEntry = (code: string): string | null => {
    const cache = getCache();
    const entry = cache[code];
    if (!entry) return null;
    // Check age
    if (Date.now() - entry.ts > CACHE_MAX_AGE) return null;
    return entry.name;
};

// --- Layer 3: TWSE Fetch (Multiple Strategies) ---

/**
 * Strategy A: Use our own Flask backend as proxy (works when backend is online)
 */
const fetchViaBackend = async (code: string): Promise<string | null> => {
    if (!API_BASE) return null; // No backend configured
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const response = await fetch(`${API_BASE}/api/stock/info/${code}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) return null;
        const data = await response.json();
        return data.status === 'success' ? data.name : null;
    } catch {
        return null; // Backend offline, silent fail
    }
};

/**
 * Strategy B: Direct TWSE fetch via public CORS proxy
 * Uses corsproxy.io as a lightweight relay
 */
const fetchViaCorsProxy = async (code: string): Promise<string | null> => {
    const twseUrl = `https://isin.twse.com.tw/isin/single_main.jsp?owncode=${code}&stockname=`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(twseUrl)}`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
        
        const response = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) return null;
        
        const html = await response.text();
        
        // Parse: look for the stock code cell followed by the name cell
        // Pattern: >CODE</td>...<td...>NAME</td>
        const regex = new RegExp(`>\\s*${code}\\s*</td>\\s*<td[^>]*>\\s*([^<]+)\\s*</td>`, 'i');
        const match = html.match(regex);
        
        if (match) {
            return match[1].trim();
        }
        return null;
    } catch {
        return null; // Network error, silent fail
    }
};

// --- Main Lookup Function ---

/**
 * 3-Tier Stock Name Lookup
 * @param code Stock code (e.g. "2330", "0050", "00878")
 * @returns Stock name or null
 */
export const lookupStockName = async (code: string): Promise<string | null> => {
    if (!code) return null;
    const cleanCode = code.trim();
    
    // --- Layer 1: Local Map (Instant) ---
    if (STOCK_NAME_MAP[cleanCode]) {
        return STOCK_NAME_MAP[cleanCode];
    }
    
    // --- Layer 2: localStorage Cache (Instant) ---
    const cached = getCacheEntry(cleanCode);
    if (cached) {
        console.log(`📦 [StockLookup] L2 Cache hit: ${cleanCode} → ${cached}`);
        return cached;
    }
    
    // --- Layer 3: Online Query (Async) ---
    console.log(`🌐 [StockLookup] L3 Online query for: ${cleanCode}`);
    
    // Try backend proxy first (faster, no CORS issues)
    let name = await fetchViaBackend(cleanCode);
    
    // Fallback to CORS proxy if backend failed
    if (!name) {
        name = await fetchViaCorsProxy(cleanCode);
    }
    
    // If found, save to L2 cache for future offline use
    if (name) {
        console.log(`✅ [StockLookup] Found: ${cleanCode} → ${name}`);
        setCacheEntry(cleanCode, name);
        return name;
    }
    
    console.log(`❌ [StockLookup] Not found: ${cleanCode}`);
    return null;
};

/**
 * Lookup Stock Code by Name (Inverse Lookup)
 * @param name Stock name (e.g. "台積電", "系統電")
 * @returns Stock code or null
 */
export const lookupStockCode = (name: string): string | null => {
    if (!name) return null;
    const cleanName = name.trim();

    // 1. Exact Match (Case-insensitive)
    for (const [code, stockName] of Object.entries(STOCK_NAME_MAP)) {
        if (stockName === cleanName) {
            return code;
        }
    }

    // 2. Exact Match in Common Aliases (Optional, could add later)
    
    // 3. Best Fuzzy Match (The one that starts with the input or is the shortest)
    let bestMatch: { code: string; name: string } | null = null;
    
    for (const [code, stockName] of Object.entries(STOCK_NAME_MAP)) {
        if (stockName.includes(cleanName)) {
            // Priority:
            // 1. Starts with input
            // 2. Is shortest among matches (e.g., "系統電" vs "系統電元大...")
            if (!bestMatch) {
                bestMatch = { code, name: stockName };
            } else {
                const currentIsStart = stockName.startsWith(cleanName);
                const bestIsStart = bestMatch.name.startsWith(cleanName);
                
                if (currentIsStart && !bestIsStart) {
                    bestMatch = { code, name: stockName };
                } else if (currentIsStart === bestIsStart && stockName.length < bestMatch.name.length) {
                    bestMatch = { code, name: stockName };
                }
            }
        }
    }

    return bestMatch ? bestMatch.code : null;
};

// --- Legacy compat (kept for any existing imports) ---
export const fetchStockInfo = async (code: string): Promise<StockInfo | null> => {
    const name = await lookupStockName(code);
    if (name) return { code, name };
    return null;
};
