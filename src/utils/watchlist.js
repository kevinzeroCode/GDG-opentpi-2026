const STORAGE_KEY = 'quant_watchlist';

// Migrate old format to current format
const migrate = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { ticker: item, shares: 0, avgCost: 0 };
    return { avgCost: 0, ...item }; // ensure avgCost exists on old entries
  });
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
    list.push({ ticker, shares: 0, avgCost: 0 });
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

export const updateAvgCost = (ticker, avgCost) => {
  const list = getWatchlist();
  const item = list.find((i) => i.ticker === ticker);
  if (item) {
    item.avgCost = Number(avgCost) || 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
};
