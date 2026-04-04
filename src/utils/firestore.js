import { db } from '../firebase';
import {
  collection, addDoc, getDocs, setDoc, deleteDoc,
  doc, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';

// ── 分析紀錄 ─────────────────────────────────────────────────────────

export const saveAnalysis = async (userId, ticker, metrics, commentary) => {
  if (!userId || !ticker) return;
  try {
    await addDoc(collection(db, 'users', userId, 'queryHistory'), {
      ticker,
      metrics: metrics || {},
      commentary: commentary || '',
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('Firestore saveAnalysis:', e);
  }
};

export const getAnalysisHistory = async (userId, limitCount = 30) => {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, 'users', userId, 'queryHistory'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
};

// ── 自選股 ────────────────────────────────────────────────────────────

export const addWatchlistItem = async (userId, ticker) => {
  if (!userId || !ticker) return;
  try {
    await setDoc(doc(db, 'users', userId, 'watchlist', ticker), {
      ticker,
      addedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('Firestore addWatchlistItem:', e);
  }
};

export const removeWatchlistItem = async (userId, ticker) => {
  if (!userId || !ticker) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'watchlist', ticker));
  } catch (e) {
    console.error('Firestore removeWatchlistItem:', e);
  }
};

export const getWatchlistFromFirestore = async (userId) => {
  if (!userId) return [];
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'watchlist'));
    return snap.docs.map(d => d.data().ticker);
  } catch (e) {
    return [];
  }
};
