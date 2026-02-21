export const parseStockData = (text) => {
  if (typeof text !== 'string') return null;

  try {
    const priceMatch = text.match(/當前價[:：]\s*([\d.]+)/);
    const rsiMatch = text.match(/RSI[:：]\s*([\d.]+)/);
    const ma5Match = text.match(/MA5[:：]\s*([\d.]+)/);
    const trendMatch = text.match(/趨勢[:：]\s*([\u4e00-\u9fa5]+)/);

    // 💡 使用 Number().toFixed(2) 並轉回 Number
    return {
      price: priceMatch ? Number(parseFloat(priceMatch[1]).toFixed(2)) : 0,
      rsi: rsiMatch ? Number(parseFloat(rsiMatch[1]).toFixed(2)) : 0,
      ma5: ma5Match ? Number(parseFloat(ma5Match[1]).toFixed(2)) : 0,
      trend: trendMatch ? trendMatch[1] : '未知',
    };
  } catch (error) {
    console.error("解析文字失敗:", error);
    return null;
  }
};