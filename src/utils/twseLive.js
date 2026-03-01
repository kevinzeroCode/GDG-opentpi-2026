const PROXY = 'http://localhost:31080/twse/stock/api/getStockInfo.jsp';

const parse = (d) => ({
  name: d.n,
  open: parseFloat(d.o) || null,
  high: parseFloat(d.h) || null,
  low: parseFloat(d.l) || null,
  last: parseFloat(d.z) || null,
  prevClose: parseFloat(d.y) || null,
  volume: parseInt(d.v, 10) || null,
  time: d.t,
  date: d.d,
});

export const fetchTWSELive = async (ticker) => {
  if (!ticker) return null;
  for (const prefix of ['tse', 'otc']) {
    const url = `${PROXY}?ex_ch=${prefix}_${ticker}.tw&json=1&delay=0`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const json = await res.json();
    if (json.msgArray?.length) return parse(json.msgArray[0]);
  }
  throw new Error('查無即時資料（僅盤中有效）');
};
