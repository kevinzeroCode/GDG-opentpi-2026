import { useState, useCallback } from 'react';

const DIGIRUNNER_URL = import.meta.env.VITE_DIGIRUNNER_URL || 'http://localhost:31080';
const TOKEN_KEY = 'dgr_access_token';
const USER_KEY = 'dgr_user';

const useDigiRunnerAuth = () => {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => sessionStorage.getItem(USER_KEY));
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const login = useCallback(async (username, password) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const form = new FormData();
      form.append('grant_type', 'password');
      form.append('username', username);
      // DigiRunner 要求密碼以 base64 傳送
      form.append('password', btoa(password));

      const res = await fetch(`${DIGIRUNNER_URL}/dgrv4/tptoken/oauth/token`, {
        method: 'POST',
        body: form,
      });

      const data = await res.json();
      if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || data.rtnMsg || '登入失敗');
      }

      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      sessionStorage.setItem(USER_KEY, username);
      setToken(data.access_token);
      setUser(username);
      return true;
    } catch (err) {
      setLoginError(err.message);
      return false;
    } finally {
      setLoginLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const isLoggedIn = !!token;

  return { token, user, isLoggedIn, login, logout, loginLoading, loginError };
};

export default useDigiRunnerAuth;
