const CACHE_PREFIX = 'candle_v2_';

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Taiwan market: Mon-Fri 09:00-13:30 (UTC+8)
const isTWMarketOpen = () => {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000); // shift to UTC+8
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  const hour = now.getUTCHours();
  const min = now.getUTCMinutes();
  if (day === 0 || day === 6) return false;
  return hour > 9 || (hour === 9 && min >= 0) ? hour < 13 || (hour === 13 && min <= 30) : false;
};

const getCache = (ticker) => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + ticker));
  } catch {
    return null;
  }
};

const setCache = (ticker, data, fetchedAt) => {
  try {
    localStorage.setItem(CACHE_PREFIX + ticker, JSON.stringify({ fetchedAt, data }));
  } catch (e) {
    // localStorage quota exceeded — try to save without oldest 20% of data
    console.warn('candle cache write failed:', e);
    try {
      const trimmed = data.slice(Math.floor(data.length * 0.2));
      localStorage.setItem(CACHE_PREFIX + ticker, JSON.stringify({ fetchedAt, data: trimmed }));
    } catch {}
  }
};

export const fetchStockCandles = async (ticker) => {
  if (!ticker) return [];

  const today = formatDate(new Date());
  const cached = getCache(ticker);

  // Cache hit: fetched today and market is currently closed → return immediately
  if (cached?.data?.length && cached.fetchedAt === today && !isTWMarketOpen()) {
    return cached.data;
  }

  // Determine incremental start date
  let startDate;
  if (!cached?.data?.length) {
    // 首次載入只抓近 5 年，避免大量資料造成卡頓
    startDate = formatDate(new Date(new Date().getFullYear() - 5, 0, 1));
  } else {
    // Fetch from day after the last data point we have
    const lastTs = cached.data[cached.data.length - 1]?.x;
    const nextDay = new Date(lastTs);
    nextDay.setDate(nextDay.getDate() + 1);
    startDate = formatDate(nextDay);

    // If startDate is in the future (can happen on weekends), no new data exists
    if (startDate > today) return cached.data;

    // If fetched today already and market is open (live session), skip to avoid hammering API
    if (cached.fetchedAt === today) return cached.data;
  }

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const url = `${API_BASE}/api/stock/${ticker}/candles?start_date=${startDate}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (json.status !== 200) throw new Error(json.msg || '查詢失敗');
  if (!json.data?.length && !cached?.data?.length) {
    throw new Error('查無資料，請確認代碼為台股代號（如 2330）');
  }

  const newData = (json.data || []).map((d) => ({
    x: new Date(d.date).getTime(),
    o: d.open,
    h: d.max,
    l: d.min,
    c: d.close,
    v: d.Trading_Volume,
  }));

  // Merge: deduplicate by timestamp (new data wins for same date)
  const dataMap = new Map();
  (cached?.data || []).forEach((c) => dataMap.set(c.x, c));
  newData.forEach((d) => dataMap.set(d.x, d));
  const merged = Array.from(dataMap.values()).sort((a, b) => a.x - b.x);

  setCache(ticker, merged, today);
  return merged;
};

export const clearCandleCache = (ticker) => {
  if (ticker) {
    localStorage.removeItem(CACHE_PREFIX + ticker);
  } else {
    // Clear all candle caches
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }
};

export const getCandleCacheInfo = (ticker) => {
  const cached = getCache(ticker);
  if (!cached) return null;
  return {
    count: cached.data?.length ?? 0,
    fetchedAt: cached.fetchedAt,
    sizeKB: Math.round(JSON.stringify(cached).length / 1024),
  };
};
