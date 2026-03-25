import { useState, useCallback, useEffect } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          user_id: firebaseUser.uid,
          username: firebaseUser.displayName || firebaseUser.email,
          email: firebaseUser.email,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const register = useCallback(async (username, email, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName: username });
      setUser({ user_id: credential.user.uid, username, email });
      return true;
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? '此 Email 已被使用' :
        err.code === 'auth/weak-password' ? '密碼至少需要 6 個字元' :
        err.code === 'auth/invalid-email' ? 'Email 格式不正確' :
        err.message;
      setAuthError(msg);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (err) {
      const msg =
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
          ? 'Email 或密碼錯誤'
          : err.message;
      setAuthError(msg);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  const isLoggedIn = !!user;

  return { user, isLoggedIn, appToken: null, dgrToken: null, register, login, logout, authLoading, authError };
};

export default useAuth;
