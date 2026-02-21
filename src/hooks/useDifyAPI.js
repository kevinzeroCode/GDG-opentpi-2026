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
      // 根據你的 image_6aaa7f.png，自架版 Dify 在 Docker 內需使用此網址
      const apiUrl = "http://host.docker.internal/v1/workflows/run"; 
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_DIFY_API_KEY}` 
        },
        body: JSON.stringify({
          inputs: {
            "query": userSearch 
          },
          response_mode: "blocking",
          user: "quant-user"
        })
      });

      const data = await response.json();
      console.log("Dify 回傳完整 JSON:", data);

      if (!response.ok) {
        throw new Error(data.message || `連線失敗: ${response.status}`);
      }

      // 🚨 核心修正：根據你的 image_6b13fc.png 輸出設定
      // 資料路徑為 data (API回傳) -> data (Dify封裝) -> outputs -> ticker
      const rawText = data.data?.outputs?.ticker;

      console.log("成功提取原始文字:", rawText);

      if (!rawText) {
        throw new Error("連線成功但找不到 'ticker' 輸出，請確認 Dify 最後一個節點有產生文字");
      }

      // 透過 parser 轉換成數字物件
      const parsedData = parseStockData(rawText);

      setAnalysisResult({
        rawText,
        metrics: parsedData
      });

    } catch (err) {
      console.error("API Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { fetchStockAnalysis, analysisResult, loading, error };
};

export default useDifyAPI;