export const parseStockData = (text) => {
  if (typeof text !== 'string') return null;

  try {
    // 匹配「當前價: 123.4」或「當前價：123.4」
    const priceMatch = text.match(/當前價[:：]\s*([\d.]+)/);
    const rsiMatch = text.match(/RSI[:：]\s*([\d.]+)/);
    const ma5Match = text.match(/MA5[:：]\s*([\d.]+)/);
    const trendMatch = text.match(/趨勢[:：]\s*([\u4e00-\u9fa5]+)/);

    return {
      price: priceMatch ? parseFloat(priceMatch[1]) : 0,
      rsi: rsiMatch ? parseFloat(rsiMatch[1]) : 0,
      ma5: ma5Match ? parseFloat(ma5Match[1]) : 0,
      trend: trendMatch ? trendMatch[1] : '未知',
    };
  } catch (error) {
    console.error("解析文字失敗:", error);
    return null;
  }
};