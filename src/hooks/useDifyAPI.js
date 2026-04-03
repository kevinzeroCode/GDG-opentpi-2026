import { useState } from 'react';
import { parseStockData } from '../utils/parser';
import { saveRecord } from '../utils/history';

const useDifyAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [lastTicker, setLastTicker] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);

  const fetchStockAnalysis = async (userSearch, _appToken) => {
    setLastQuery(userSearch);
    setLoading(true);
    setError(null);

    try {
      // 使用相對路徑，由 nginx server-side proxy 加上 Authorization header
      // API Key 不出現在前端程式碼或瀏覽器中
      const apiUrl = '/dify/v1/workflows/run';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: { query: userSearch },
          response_mode: 'blocking',
          user: 'quant-user'
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Error: ${response.status}`);

      const rawText = data.data?.outputs?.ticker || null;
      const commentary = data.data?.outputs?.commentary || null;
      const tickerCode = data.data?.outputs?.ticker_code || null;

      if (!rawText && commentary) {
        setAnalysisResult({ rawText: null, metrics: null, commentary });
        setLastTicker(null);
        return;
      }

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

      const tickerMatch = userSearch.match(/\d{4,}/);
      const ticker = (tickerCode && /^\d{4,6}$/.test(tickerCode.trim()))
        ? tickerCode.trim()
        : tickerMatch
          ? tickerMatch[0]
          : userSearch.trim();

      setAnalysisResult({ rawText, metrics: parsedData, commentary });
      setLastTicker(ticker);
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
  const clearHistory = () => { setAnalysisResult(null); setLastTicker(null); };

  return { fetchStockAnalysis, analysisResult, loading, error, lastTicker, retry, clearHistory };
};

export default useDifyAPI;
