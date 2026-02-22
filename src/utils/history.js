const MAX_RECORDS = 50;
const KEY_PREFIX = 'quant_history_';

export const saveRecord = (ticker, metrics) => {
  if (!ticker || !metrics) return;

  const key = KEY_PREFIX + ticker;
  const history = getHistory(ticker);

  history.push({
    timestamp: Date.now(),
    ticker,
    metrics,
  });

  // Keep only the latest MAX_RECORDS
  if (history.length > MAX_RECORDS) {
    history.splice(0, history.length - MAX_RECORDS);
  }

  localStorage.setItem(key, JSON.stringify(history));
};

export const getHistory = (ticker) => {
  if (!ticker) return [];
  const key = KEY_PREFIX + ticker;
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

export const clearHistory = (ticker) => {
  if (!ticker) return;
  localStorage.removeItem(KEY_PREFIX + ticker);
};

export const getAllTickers = () => {
  const tickers = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(KEY_PREFIX)) {
      tickers.push(key.slice(KEY_PREFIX.length));
    }
  }
  return tickers;
};

export const getHistoryInRange = (ticker, startTs, endTs) => {
  const history = getHistory(ticker);
  return history.filter((r) => r.timestamp >= startTs && r.timestamp <= endTs);
};

export const calcAnnualizedReturn = (history) => {
  if (!history || history.length < 2) return null;

  const first = history[0];
  const last = history[history.length - 1];
  const startPrice = first.metrics?.price;
  const endPrice = last.metrics?.price;

  if (!startPrice || !endPrice) return null;

  const ms = last.timestamp - first.timestamp;
  const days = ms / (1000 * 60 * 60 * 24);

  // Less than 1 day: show simple return instead of annualized
  if (days < 1) return ((endPrice / startPrice) - 1) * 100;

  return (Math.pow(endPrice / startPrice, 365 / days) - 1) * 100;
};
