import { useState } from 'react';
import { parseStockData } from '../utils/parser';

const useDifyAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const fetchStockAnalysis = async (userSearch) => {
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

      if (rawText) {
        // 解析並處理小數點 (parser 內部已做 toFixed)
        const parsedData = parseStockData(rawText);
        setAnalysisResult({ rawText, metrics: parsedData });
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { fetchStockAnalysis, analysisResult, loading, error };
};

export default useDifyAPI;