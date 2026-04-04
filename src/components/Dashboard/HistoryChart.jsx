import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, LogIn, Clock } from 'lucide-react';
import { getAnalysisHistory } from '../../utils/firestore';
import { getTickerShort } from '../../utils/tickerNames';

// 統計最常查詢的股票
const getTopTickers = (records, n = 4) => {
  const counts = {};
  records.forEach(r => { counts[r.ticker] = (counts[r.ticker] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([ticker]) => ticker);
};

const parseRSS = (xmlText) => {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const items = xml.querySelectorAll('item');
    return Array.from(items).slice(0, 4).map(item => {
      const rawTitle = item.querySelector('title')?.textContent || '';
      // Google News title often has " - 來源" suffix, strip it
      const title = rawTitle.replace(/ - [^-]+$/, '').replace(/<[^>]*>/g, '').trim();
      const link = item.querySelector('link')?.textContent || '';
      const pubDate = item.querySelector('pubDate')?.textContent || '';
      const date = pubDate ? new Date(pubDate) : null;
      const dateStr = date && !isNaN(date)
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : '';
      return { title, link, dateStr };
    }).filter(item => item.title);
  } catch {
    return [];
  }
};

const NewsCard = ({ ticker }) => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const companyName = getTickerShort(ticker);
  const searchQuery = companyName !== ticker ? companyName : ticker;

  useEffect(() => {
    const url = `/gnews/?q=${encodeURIComponent(searchQuery)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
    fetch(url)
      .then(r => r.text())
      .then(text => {
        setNews(parseRSS(text));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ticker]);

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-blue-400">{companyName}</span>
        <span className="text-xs text-slate-600">{ticker}</span>
        <Newspaper size={12} className="text-slate-600 ml-auto" />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
          載入新聞中...
        </div>
      ) : news.length === 0 ? (
        <p className="text-xs text-slate-600">暫無新聞資料</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              {item.dateStr && (
                <span className="text-xs text-slate-600 shrink-0 mt-0.5 w-8">{item.dateStr}</span>
              )}
              <span className="text-xs text-slate-300 group-hover:text-blue-400 transition-colors leading-relaxed line-clamp-2 flex-1">
                {item.title}
              </span>
              <ExternalLink size={10} className="shrink-0 mt-0.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryChart = ({ ticker, user }) => {
  const [topTickers, setTopTickers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getAnalysisHistory(user.user_id, 100).then((data) => {
      const top = getTopTickers(data, 4);
      // 如果沒有紀錄但有當前股票，顯示當前股票
      setTopTickers(top.length > 0 ? top : (ticker ? [ticker] : []));
      setLoading(false);
    });
  }, [user]);

  // 當使用者查新股票時，若尚未在列表中則加入最前面
  useEffect(() => {
    if (!ticker || !user) return;
    setTopTickers(prev => {
      if (prev.includes(ticker)) return prev;
      return [ticker, ...prev].slice(0, 4);
    });
  }, [ticker]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px] gap-3">
        <LogIn size={40} className="opacity-20" />
        <p className="text-sm">登入後自動追蹤<br />常用股票最新消息</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500 gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">載入中...</p>
      </div>
    );
  }

  if (topTickers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
        <Newspaper size={40} className="mb-3 opacity-20" />
        <p className="text-sm">查詢股票後<br />自動顯示相關新聞摘要</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium">消息面追蹤</span>
        <span className="text-xs text-slate-600">依查詢頻率 · 前 {topTickers.length} 檔</span>
      </div>
      <div className="flex flex-col gap-3">
        {topTickers.map(t => (
          <NewsCard key={t} ticker={t} />
        ))}
      </div>
    </div>
  );
};

export default HistoryChart;
