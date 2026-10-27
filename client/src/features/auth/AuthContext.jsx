import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../../services/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const accessTokenRef = useRef(null);

  const applySession = useCallback((session) => {
    accessTokenRef.current = session?.accessToken || null;
    setUser(session?.user || null);
    setStatus(session?.user ? 'authenticated' : 'unauthenticated');
    setError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const session = await authApi.refresh();
      applySession(session);
      return session;
    } catch (refreshError) {
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
      if (refreshError.status !== 401) setError(refreshError.message);
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(async (input) => {
    setStatus('submitting');
    setError(null);
    try {
      const session = await authApi.login(input);
      applySession(session);
      return session;
    } catch (loginError) {
      setStatus('unauthenticated');
      setError(loginError);
      throw loginError;
    }
  }, [applySession]);

  const signUp = useCallback(async (input) => {
    setStatus('submitting');
    setError(null);
    try {
      const session = await authApi.register(input);
      applySession(session);
      return session;
    } catch (registerError) {
      setStatus('unauthenticated');
      setError(registerError);
      throw registerError;
    }
  }, [applySession]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      accessTokenRef.current = null;
      setUser(null);
      setError(null);
      setStatus('unauthenticated');
    }
  }, []);

  const updateUser = useCallback((nextUser) => {
    setUser((current) => ({ ...current, ...nextUser }));
  }, []);

  const value = useMemo(() => ({
    user,
    status,
    error,
    accessToken: accessTokenRef.current,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    signIn,
    signUp,
    signOut,
    refreshSession,
    updateUser,
  }), [error, refreshSession, signIn, signOut, signUp, status, user, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
