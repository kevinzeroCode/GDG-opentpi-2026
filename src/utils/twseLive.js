const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const fetchTWSELive = async (ticker) => {
  if (!ticker) return null;
  const res = await fetch(`${API_BASE}/api/stock/${ticker}/live`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || '查無即時資料（僅盤中有效）');
  }
  const d = await res.json();
  // 維持向下相容的欄位名稱
  return {
    name: d.name,
    open: d.open,
    high: d.high,
    low: d.low,
    last: d.last,
    prevClose: d.prev_close,
    volume: d.volume,
    time: d.time,
    date: d.date,
  };
};
