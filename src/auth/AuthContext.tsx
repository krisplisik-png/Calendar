import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { humanizeFirebaseError } from '../lib/errors';
import type { UserProfile } from '../types';

interface AuthState {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let authStateReceived = false;
    const timeout = window.setTimeout(() => {
      if (authStateReceived) return;
      setLoading(false);
      setError('Firebase долго не отвечает. Форма входа доступна, но проверьте интернет, если авторизация не сработает.');
    }, 4_000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      authStateReceived = true;
      window.clearTimeout(timeout);
      setLoading(true);
      setError(null);
      setFirebaseUser(user);
      setUserProfile(null);
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, 'users', user.uid));
        if (!snapshot.exists()) throw new Error('profile-missing');
        const data = snapshot.data() as Partial<UserProfile>;
        if (!data.role || !data.schoolId) throw new Error('profile-incomplete');
        setUserProfile({
          name: data.name?.trim() || user.displayName || data.email || user.email || 'Администратор',
          email: data.email || user.email || '',
          role: data.role,
          schoolId: data.schoolId,
        });
      } catch (nextError) {
        setError(nextError instanceof Error && nextError.message === 'profile-missing'
          ? 'Профиль пользователя users/{uid} не найден.'
          : nextError instanceof Error && nextError.message === 'profile-incomplete'
            ? 'В профиле пользователя должны быть заполнены role и schoolId.'
            : humanizeFirebaseError(nextError));
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    firebaseUser,
    userProfile,
    loading,
    error,
    logout: () => signOut(auth),
  }), [firebaseUser, userProfile, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
