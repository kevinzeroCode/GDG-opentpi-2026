export const fetchTWSELive = async (ticker) => {
  if (!ticker) return null;

  const res = await fetch(`/api/stock/${ticker}/live-or-last`);
  if (!res.ok) throw new Error('查無即時資料');
  const d = await res.json();

  return {
    name: d.name || ticker,
    open: d.open,
    high: d.high,
    low: d.low,
    last: d.last,
    prevClose: d.prev_close,
    isLive: d.source !== 'db',
    volume: d.volume,
    time: d.time,
    date: d.date,
  };
};
