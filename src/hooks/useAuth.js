import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const useAuth = () => {
  const stored = () => {
    try { return JSON.parse(sessionStorage.getItem('auth_user') || 'null'); } catch { return null; }
  };
  const [user, setUser] = useState(stored);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const saveSession = (data) => {
    sessionStorage.setItem('auth_user', JSON.stringify({
      user_id: data.user_id,
      username: data.username,
      email: data.email,
    }));
    sessionStorage.setItem('app_token', data.access_token);
    if (data.dgr_token) sessionStorage.setItem('dgr_access_token', data.dgr_token);
    setUser({ user_id: data.user_id, username: data.username, email: data.email });
  };

  const register = useCallback(async (username, email, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '註冊失敗');
      saveSession(data);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || '登入失敗');
      saveSession(data);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('auth_user');
    sessionStorage.removeItem('app_token');
    sessionStorage.removeItem('dgr_access_token');
    sessionStorage.removeItem('dgr_user');
    setUser(null);
  }, []);

  const appToken = sessionStorage.getItem('app_token');
  const dgrToken = sessionStorage.getItem('dgr_access_token');
  const isLoggedIn = !!user;

  return { user, isLoggedIn, appToken, dgrToken, register, login, logout, authLoading, authError };
};

export default useAuth;
