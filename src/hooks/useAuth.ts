
// [Manage] Last Updated: 2024-05-22
import { useState, useEffect } from 'react';
import { auth, db, config } from '../firebaseConfig';
import { GoogleAuthProvider } from 'firebase/auth'; // FIX: Import directly from modular SDK
import { User } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
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
                setUser(null);
                setStatus('offline');
            }
        });
        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            // FIX: Use the explicitly imported class
            const provider = new GoogleAuthProvider();
            
            // FIX: Use string literal 'local' which is safer than accessing firebase.auth.Auth.Persistence.LOCAL
            await auth.setPersistence('local');
            
            await auth.signInWithPopup(provider);
        } catch (e: any) {
            console.error("Login failed", e);
            // Handle environment-specific errors gracefully
            if (e.code === 'auth/operation-not-supported-in-this-environment' || e.message?.includes('location.protocol')) {
                alert("Login failed: This environment does not support Firebase Authentication.\n\nReason: 'location.protocol' must be http or https, and web storage must be enabled.\n\nTip: If running locally, ensure you use 'http://localhost' and not 'file://'.");
            } else if (e.code === 'auth/popup-blocked') {
                alert("Login popup was blocked by the browser. Please allow popups for this site.");
            } else if (e.code === 'auth/unauthorized-domain') {
                alert("Login failed: This domain is not authorized in the Firebase Console.");
            } else {
                alert(`Login Error: ${e.message}`);
            }
        }
    };

    const logout = async () => {
        try {
            await auth.signOut();
        } catch (e) {
            console.error("Logout failed", e);
        }
    };

    return { user, status, db, config, login, logout };
};
