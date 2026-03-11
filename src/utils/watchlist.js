const STORAGE_KEY = 'quant_watchlist';
const API_BASE = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Migrate old format to current format
const migrate = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { ticker: item, shares: 0, avgCost: 0 };
    return { avgCost: 0, ...item };
  });
};

// ── 靜默同步到中台（失敗不影響本地操作）──────────────────────────
const getAuthHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const getAppToken = () => {
  try { return sessionStorage.getItem('app_token') || null; } catch { return null; }
};

const syncAdd = (ticker) => {
  const token = getAppToken();
  fetch(`${API_BASE()}/api/watchlist`, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify({ ticker }),
  }).catch(() => {});
};

const syncRemove = (ticker) => {
  const token = getAppToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  fetch(`${API_BASE()}/api/watchlist/${ticker}`, { method: 'DELETE', headers }).catch(() => {});
};

// ── 本地 localStorage 操作（同步）────────────────────────────────

export const getWatchlist = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const list = migrate(raw);
    if (raw.length > 0 && typeof raw[0] === 'string') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return [];
  }
};

export const addToWatchlist = (ticker) => {
  if (!ticker) return;
  const list = getWatchlist();
  if (!list.some((item) => item.ticker === ticker)) {
    list.push({ ticker, shares: 0, avgCost: 0 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    syncAdd(ticker); // 同步到中台 ETL 追蹤清單
  }
};

export const removeFromWatchlist = (ticker) => {
  const list = getWatchlist().filter((item) => item.ticker !== ticker);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  syncRemove(ticker); // 從中台移除
};

export const isInWatchlist = (ticker) => {
  return getWatchlist().some((item) => item.ticker === ticker);
};

export const updateShares = (ticker, shares) => {
  const list = getWatchlist();
  const item = list.find((i) => i.ticker === ticker);
  if (item) {
    item.shares = Number(shares) || 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
};

export const updateAvgCost = (ticker, avgCost) => {
  const list = getWatchlist();
  const item = list.find((i) => i.ticker === ticker);
  if (item) {
    item.avgCost = Number(avgCost) || 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
};

// ── 從中台載入自選股（App 啟動時呼叫）────────────────────────────
export const syncWatchlistFromPlatform = async (token) => {
  try {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE()}/api/watchlist`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const remoteTickers = data.items.map((i) => i.ticker);
    const local = getWatchlist();
    const localTickers = local.map((i) => i.ticker);

    // 把中台有、本地沒有的加進來（保留本地的 shares/avgCost）
    let changed = false;
    for (const t of remoteTickers) {
      if (!localTickers.includes(t)) {
        local.push({ ticker: t, shares: 0, avgCost: 0 });
        changed = true;
      }
    }
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
  } catch {
    // 中台不可用時靜默忽略，本地資料仍正常運作
  }
};
