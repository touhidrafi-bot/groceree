'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { authService, AuthState, User as _user } from '../lib/auth';

interface AuthContextType extends AuthState {
  isRehydrated: boolean;
  signUp: any;
  signIn: any;
  signOut: any;
  updateProfile: any;
  resetPassword: any;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });

  const [isRehydrated, setIsRehydrated] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        unsubscribeRef.current = authService.subscribe((newState) => {
          if (!mounted) return;

          // Update auth state
          setAuthState(newState);

          // Mark rehydration ONLY after first real state arrives
          if (!isRehydrated) {
            setIsRehydrated(true);
          }
        });
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsRehydrated(true);
          setAuthState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [isRehydrated]);

  const value: AuthContextType = {
    ...authState,
    isRehydrated,
    signUp: authService.signUp.bind(authService),
    signIn: authService.signIn.bind(authService),
    signOut: authService.signOut.bind(authService),
    updateProfile: authService.updateProfile.bind(authService),
    resetPassword: authService.resetPassword.bind(authService),
    hasRole: authService.hasRole.bind(authService),
    hasAnyRole: authService.hasAnyRole.bind(authService)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
