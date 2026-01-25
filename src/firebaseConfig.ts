
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
    getFirestore, 
    initializeFirestore, 
    CACHE_SIZE_UNLIMITED,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache
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
 * Robust Firestore Initialization
 * Guards against "Unexpected state" errors common in HMR/Multi-tab environments
 */
const getDb = () => {
    // 1. Try to get existing instance (HMR guard)
    try {
        const existingDb = getFirestore(app);
        if (existingDb) return existingDb;
    } catch (e) {
        // Continue to initialization
    }

    // 2. Attempt Persistence Initialization
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
                cacheSizeBytes: CACHE_SIZE_UNLIMITED
            })
        });
    } catch (e: any) {
        console.warn("Firestore Persistence failed, falling back to memory cache:", e.message);
        
        // 3. Fallback to Memory Cache (prevents "Unexpected state" crashes)
        return initializeFirestore(app, {
            localCache: memoryLocalCache()
        });
    }
};

export const db = getDb();
export const config = { appId: firebaseConfig.projectId };

export default app;
