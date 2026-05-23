export async function fetchInstitutional(ticker, days = 40) {
  const res = await fetch(`/api/chips/${ticker}/institutional?days=${days}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `無法取得 ${ticker} 的籌碼資料`);
  }
  return res.json();
}

// FinMind 回傳英文名稱（Foreign_Investor, Foreign_Dealer_Self, Investment_Trust 等）
const isForeign = (name) => name.includes('外資') || name.startsWith('Foreign');
const isTrust   = (name) => name.includes('投信') || name === 'Investment_Trust';

/**
 * 將 API 原始資料整理成 [{ date, foreign, trust }, ...] 依日期升序。
 * 單位：張（正 = 買超，負 = 賣超）。
 */
export function processInstitutional(rawData) {
  const byDate = {};
  for (const row of rawData.data) {
    const d = String(row.date);
    if (!byDate[d]) byDate[d] = { date: d, foreign: 0, trust: 0 };
    if (isForeign(row.name)) {
      byDate[d].foreign += row.net;
    } else if (isTrust(row.name)) {
      byDate[d].trust += row.net;
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export function calcCumulative(processed, field, n) {
  return processed.slice(-n).reduce((sum, d) => sum + (d[field] ?? 0), 0);
}
