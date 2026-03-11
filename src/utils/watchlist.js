const ANON_KEY = 'quant_watchlist';
const API_BASE = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── 取得目前使用者的 localStorage key ───────────────────────────
const storageKey = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('auth_user') || 'null');
    return user?.user_id ? `quant_watchlist_u${user.user_id}` : ANON_KEY;
  } catch {
    return ANON_KEY;
  }
};

const getAppToken = () => {
  try { return sessionStorage.getItem('app_token') || null; } catch { return null; }
};

const authHeaders = () => {
  const token = getAppToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

// ── 格式遷移 ─────────────────────────────────────────────────────
const migrate = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) =>
    typeof item === 'string' ? { ticker: item, shares: 0, avgCost: 0 } : { avgCost: 0, ...item }
  );
};

// ── 靜默後端同步（失敗不影響本地操作）────────────────────────────
const syncAdd = (ticker) =>
  fetch(`${API_BASE()}/api/watchlist`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ ticker }),
  }).catch(() => {});

const syncRemove = (ticker) =>
  fetch(`${API_BASE()}/api/watchlist/${ticker}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {});

// ── 本地 localStorage 操作 ────────────────────────────────────────
export const getWatchlist = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey())) || [];
    return migrate(raw);
  } catch {
    return [];
  }
};

export const addToWatchlist = (ticker) => {
  if (!ticker) return;
  const list = getWatchlist();
  if (!list.some((item) => item.ticker === ticker)) {
    list.push({ ticker, shares: 0, avgCost: 0 });
    localStorage.setItem(storageKey(), JSON.stringify(list));
    syncAdd(ticker);
  }
};

export const removeFromWatchlist = (ticker) => {
  const list = getWatchlist().filter((item) => item.ticker !== ticker);
  localStorage.setItem(storageKey(), JSON.stringify(list));
  syncRemove(ticker);
};

export const isInWatchlist = (ticker) =>
  getWatchlist().some((item) => item.ticker === ticker);

export const updateShares = (ticker, shares) => {
  const list = getWatchlist();
  const item = list.find((i) => i.ticker === ticker);
  if (item) {
    item.shares = Number(shares) || 0;
    localStorage.setItem(storageKey(), JSON.stringify(list));
  }
};

export const updateAvgCost = (ticker, avgCost) => {
  const list = getWatchlist();
  const item = list.find((i) => i.ticker === ticker);
  if (item) {
    item.avgCost = Number(avgCost) || 0;
    localStorage.setItem(storageKey(), JSON.stringify(list));
  }
};

// ── 登入後從後端載入個人自選股（覆蓋本地，保留 shares/avgCost）──
export const syncWatchlistFromPlatform = async (token) => {
  try {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE()}/api/watchlist`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const remoteTickers = data.items.map((i) => i.ticker);

    // 保留目前本地的 shares/avgCost（轉成 map 備用）
    const localMap = Object.fromEntries(
      getWatchlist().map((i) => [i.ticker, { shares: i.shares, avgCost: i.avgCost }])
    );

    // 用後端清單覆蓋（不再合併舊本地資料）
    const merged = remoteTickers.map((t) => ({
      ticker: t,
      shares: localMap[t]?.shares || 0,
      avgCost: localMap[t]?.avgCost || 0,
    }));

    localStorage.setItem(storageKey(), JSON.stringify(merged));
  } catch {
    // 後端不可用時靜默忽略
  }
};
