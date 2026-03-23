import { useState } from 'react';
import { parseStockData } from '../utils/parser';
import { saveRecord } from '../utils/history';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:9000/gateway';

const useDifyAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [lastTicker, setLastTicker] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);

  const fetchStockAnalysis = async (userSearch, appToken = null) => {
    setLastQuery(userSearch);
    setLoading(true);
    setError(null);

    try {
      // 帶入最近兩輪對話作為上下文
      const recentContext = conversationHistory.slice(-2)
        .map(h => `[前次查詢: ${h.query} → 股票: ${h.ticker || '未識別'}]`)
        .join(' ');
      const contextualQuery = recentContext ? `${recentContext}\n${userSearch}` : userSearch;

      // 統一走 data-platform：登入時帶 App JWT 識別身份，未登入走 nginx gateway（rate limit）
      const apiUrl = appToken
        ? `${API_BASE}/api/ai/analyze`
        : `${GATEWAY_URL}/ai/analyze`;
      const headers = {
        'Content-Type': 'application/json',
        ...(appToken && { 'Authorization': `Bearer ${appToken}` }),
      };

      // Pass the most recent conversation_id for chat mode continuity
      const lastConversationId = conversationHistory.slice(-1)[0]?.conversation_id || null;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: contextualQuery, conversation_id: lastConversationId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Error: ${response.status}`);

      const rawText = data.ticker || null;
      const commentary = data.commentary || null;
      const tickerCode = data.ticker_code || null;
      const newConversationId = data.conversation_id || null;

      // 一般問答（無股票代號）
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

      // 優先使用 Dify 提取的代號（最準確），其次從輸入字串取數字
      const tickerMatch = userSearch.match(/\d{4,}[A-Za-z]*/);
      const ticker = (tickerCode && /^\d{4,6}[A-Za-z]*$/.test(tickerCode.trim()))
        ? tickerCode.trim()
        : tickerMatch
          ? tickerMatch[0]
          : userSearch.trim();

      setAnalysisResult({ rawText, metrics: parsedData, commentary });
      setLastTicker(ticker);

      // 記錄對話歷史（最多保留 5 輪），包含 conversation_id 供下次請求使用
      setConversationHistory(prev => [
        ...prev.slice(-4),
        { query: userSearch, ticker, conversation_id: newConversationId },
      ]);

      // Auto-save to history
      saveRecord(ticker, parsedData);

    } catch (err) {
      const msg = err.message?.includes('429')
        ? '查詢過於頻繁，請稍後再試（每分鐘上限 10 次）。'
        : err.message?.includes('401') || err.message?.includes('403')
          ? '認證失敗，請重新登入。'
          : err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')
            ? '無法連線至分析服務，請確認各服務是否正常運行。'
            : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const retry = (token) => lastQuery && fetchStockAnalysis(lastQuery, token);

  const clearHistory = () => setConversationHistory([]);

  return { fetchStockAnalysis, analysisResult, loading, error, lastTicker, retry, clearHistory };
};

export default useDifyAPI;
