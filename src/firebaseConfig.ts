
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
// Loaded from environment so the project can be forked / re-deployed without
// hardcoding credentials. Defaults preserve the original public values so
// existing deployments keep working until env vars are wired up.
// NOTE: Web Firebase keys are public by design; real protection comes from
// Firebase Security Rules + App Check, which should be configured in console.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyA4wsQ5K6yETn2KTJrj756ZdrDirsjKX-4",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "tradetrack-fbcc3.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "tradetrack-fbcc3",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "tradetrack-fbcc3.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "29117768850",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:29117768850:web:668fcaf1164a0a07adb24b",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-DJ5M32QLKY"
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
