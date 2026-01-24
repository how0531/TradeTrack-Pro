
// [Manage] Last Updated: 2024-05-22
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

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

// Initialize Firestore with settings optimized for offline usage
// Use initializeFirestore only if it hasn't been initialized yet to avoid HMR issues
let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        // In newer SDKs, experimentalAutoDetectLongPolling can help in environments with network issues
        // experimentalAutoDetectLongPolling: true 
    });
} catch (e) {
    dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const config = { appId: firebaseConfig.projectId };

// Enable Offline Persistence with tab management and HMR guard
if (!(window as any)._firestorePersistenceEnabled) {
    (window as any)._firestorePersistenceEnabled = true;
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open.');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence not supported by this browser.');
        } else {
            console.error('Firestore persistence unexpected error:', err);
        }
    });
}

export default app;
