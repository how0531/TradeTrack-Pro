
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
    getFirestore, 
    initializeFirestore, 
    CACHE_SIZE_UNLIMITED,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache,
    Firestore,
    terminate,
    clearIndexedDbPersistence
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyA4wsQ5K6yETn2KTJrj756ZdrDirsjKX-4",
    authDomain: "tradetrack-fbcc3.firebaseapp.com",
    projectId: "tradetrack-fbcc3",
    storageBucket: "tradetrack-fbcc3.firebasestorage.app",
    messagingSenderId: "29117768850",
    appId: "1:29117768850:web:668fcaf1164a0a07adb24b",
    measurementId: "G-DJ5M32QLKY"
};

// Initialize Firebase (Modular SDK) with HMR guard
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

/**
 * GLOBAL SINGLETON GUARD for Firestore
 * This prevents "Unexpected state" errors during Vite HMR or fast refreshes.
 */
declare global {
  interface Window {
    __firestore_instance?: Firestore;
  }
}

const getStoredDb = () => {
    if (typeof window !== 'undefined' && window.__firestore_instance) {
        return window.__firestore_instance;
    }
    return null;
};

const setStoredDb = (instance: Firestore) => {
    if (typeof window !== 'undefined') {
        window.__firestore_instance = instance;
    }
};

const initializeDb = () => {
    const existing = getStoredDb();
    if (existing) return existing;

    try {
        // Attempt to get from Firebase App internal state if already initialized
        const fbDb = getFirestore(app);
        if (fbDb) {
            setStoredDb(fbDb);
            return fbDb;
        }
    } catch (e) {
        // Not initialized yet
    }

    try {
        const dbInstance = initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
                cacheSizeBytes: CACHE_SIZE_UNLIMITED
            })
        });
        setStoredDb(dbInstance);
        return dbInstance;
    } catch (e: any) {
        console.warn("Firestore Persistence setup failed, falling back to basic:", e.message);
        const fallbackDb = initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
        setStoredDb(fallbackDb);
        return fallbackDb;
    }
};

export const db = initializeDb();
export const config = { appId: firebaseConfig.projectId };

/**
 * Utility to forcefully reset local cache if things get corrupted
 */
export const resetFirestoreCache = async () => {
    try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
        window.location.reload();
    } catch (e) {
        console.error("Cache reset failed", e);
        // Fallback: just reload
        window.location.reload();
    }
};

export default app;
