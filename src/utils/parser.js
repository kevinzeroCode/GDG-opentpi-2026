export const parseStockData = (text) => {
  if (typeof text !== 'string') return null;

  try {
    const priceMatch = text.match(/當前價[:：]\s*([\d.]+)/);
    const rsiMatch = text.match(/RSI[:：]\s*([\d.]+)/);
    const ma5Match = text.match(/MA5[:：]\s*([\d.]+)/);
    const kMatch = text.match(/K值[:：]\s*([\d.]+)/);
    const dMatch = text.match(/D值[:：]\s*([\d.]+)/);
    const macdMatch = text.match(/MACD[:：]\s*(-?[\d.]+)/);
    const signalMatch = text.match(/Signal[:：]\s*(-?[\d.]+)/);
    const histMatch = text.match(/Histogram[:：]\s*(-?[\d.]+)/);
    const trendMatch = text.match(/趨勢[:：]\s*([\u4e00-\u9fa5]+)/);

    return {
      price: priceMatch ? Number(parseFloat(priceMatch[1]).toFixed(2)) : 0,
      rsi: rsiMatch ? Number(parseFloat(rsiMatch[1]).toFixed(2)) : 0,
      ma5: ma5Match ? Number(parseFloat(ma5Match[1]).toFixed(2)) : 0,
      k: kMatch ? Number(parseFloat(kMatch[1]).toFixed(2)) : null,
      d: dMatch ? Number(parseFloat(dMatch[1]).toFixed(2)) : null,
      macd: macdMatch ? Number(parseFloat(macdMatch[1]).toFixed(2)) : null,
      signal: signalMatch ? Number(parseFloat(signalMatch[1]).toFixed(2)) : null,
      histogram: histMatch ? Number(parseFloat(histMatch[1]).toFixed(2)) : null,
      trend: trendMatch ? trendMatch[1] : '未知',
    };
  } catch (error) {
    console.error("解析文字失敗:", error);
    return null;
  }
};