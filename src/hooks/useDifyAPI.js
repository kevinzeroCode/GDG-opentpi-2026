import { useState } from 'react';
import { parseStockData } from '../utils/parser';
import { saveRecord } from '../utils/history';

const useDifyAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [lastTicker, setLastTicker] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);

  const fetchStockAnalysis = async (userSearch) => {
    setLastQuery(userSearch);
    setLoading(true);
    setError(null);

    try {
      // 未來若要接 AWS 或 DigiRunner，只需改此網址
      const apiUrl = import.meta.env.VITE_DIFY_API_URL + "/workflows/run"; 
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_DIFY_API_KEY}`
        },
        body: JSON.stringify({
          inputs: { "query": userSearch },
          response_mode: "blocking",
          user: "quant-user"
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Error: ${response.status}`);

      // 提取原始文字
      const rawText = data.data?.outputs?.ticker;

      // Extract ticker from query (e.g. "2330" from "2330" or "分析 2330")
      const tickerMatch = userSearch.match(/\d{4,}/);
      const ticker = tickerMatch ? tickerMatch[0] : userSearch.trim();

      if (!rawText) {
        setError('查詢未取得資料，請確認股票代碼是否正確，或稍後再試。');
        return;
      }

      if (rawText.includes('數據不足')) {
        setError('該股票近期交易資料不足，無法計算技術指標。');
        return;
      }

      if (rawText.includes('計算錯誤')) {
        setError(`分析時發生問題：${rawText}，請稍後重試。`);
        return;
      }

      const parsedData = parseStockData(rawText);

      if (!parsedData || parsedData.price === 0) {
        setError('資料解析失敗，取得的數據格式異常，請稍後重試。');
        return;
      }

      setAnalysisResult({ rawText, metrics: parsedData });
      setLastTicker(ticker);

      // Auto-save to history
      saveRecord(ticker, parsedData);

    } catch (err) {
      const msg = err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
        ? '無法連線至分析服務，請確認 Dify 服務是否正常運行。'
        : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => lastQuery && fetchStockAnalysis(lastQuery);

  return { fetchStockAnalysis, analysisResult, loading, error, lastTicker, retry };
};

export default useDifyAPI;