const STORAGE_KEY = 'quant_watchlist';

// Migrate old format (string[]) to new format ({ ticker, shares }[])
const migrate = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'string') {
    return raw.map((ticker) => ({ ticker, shares: 0 }));
  }
  return raw;
};

export const getWatchlist = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    const list = migrate(raw);
    // Persist migrated format
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
    list.push({ ticker, shares: 0 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
};

export const removeFromWatchlist = (ticker) => {
  const list = getWatchlist().filter((item) => item.ticker !== ticker);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
