
// [Manage] Last Updated: 2024-05-22
import { useState, useEffect } from 'react';
import { auth, db, config } from '../firebaseConfig';
import firebase from 'firebase/compat/app';
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
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (e) {
            console.error("Login failed", e);
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
