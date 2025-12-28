
// [Manage] Last Updated: 2024-05-22
import { initializeApp } from 'firebase/app';
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

// Initialize Firebase
// Using Modular SDK initialization
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with settings optimized for offline usage
export const db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

export const config = { appId: firebaseConfig.projectId };

// Enable Offline Persistence
// This drastically reduces read costs by caching data in the browser's IndexedDB.
// Subsequent loads will read from local cache unless data has changed on the server.
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a a time.
        console.warn('Firestore persistence failed: Multiple tabs open.');
    } else if (err.code == 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn('Firestore persistence not supported by this browser.');
    }
});

export default app;
