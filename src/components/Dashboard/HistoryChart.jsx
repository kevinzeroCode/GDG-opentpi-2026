import React, { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, LogIn } from 'lucide-react';
import { getAnalysisHistory } from '../../utils/firestore';
import { getTickerShort } from '../../utils/tickerNames';

const SignalBadge = ({ metrics }) => {
  if (!metrics) return null;
  const rsi = metrics.rsi;
  if (rsi === undefined) return null;

  if (rsi >= 70) return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-700/40">
      <TrendingDown size={10} /> 偏空
    </span>
  );
  if (rsi <= 30) return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
      <TrendingUp size={10} /> 偏多
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/40">
      <Minus size={10} /> 中性
    </span>
  );
};

const RecordCard = ({ record }) => {
  const [expanded, setExpanded] = useState(false);
  const { ticker, metrics, commentary, createdAt } = record;

  const ts = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt?.seconds * 1000 || Date.now());
  const dateStr = ts.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
  const timeStr = ts.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

  const shortCommentary = commentary?.length > 60 ? commentary.substring(0, 60) + '...' : commentary;

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 transition-all hover:border-slate-600">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-400">{getTickerShort(ticker)}</span>
          <SignalBadge metrics={metrics} />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={11} />
          <span>{dateStr} {timeStr}</span>
        </div>
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="flex gap-3 mb-3 text-xs text-slate-400">
          {metrics.price !== undefined && (
            <span>股價 <span className="text-slate-200 font-medium">{metrics.price}</span></span>
          )}
          {metrics.rsi !== undefined && (
            <span>RSI <span className={`font-medium ${metrics.rsi >= 70 ? 'text-red-400' : metrics.rsi <= 30 ? 'text-emerald-400' : 'text-slate-200'}`}>{metrics.rsi?.toFixed(1)}</span></span>
          )}
          {metrics.k !== undefined && (
            <span>K <span className="text-slate-200 font-medium">{metrics.k?.toFixed(1)}</span></span>
          )}
          {metrics.macd !== undefined && (
            <span>MACD <span className={`font-medium ${metrics.macd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{metrics.macd?.toFixed(2)}</span></span>
          )}
        </div>
      )}

      {/* Commentary */}
      {commentary && (
        <div className="text-xs text-slate-400 leading-relaxed">
          <p>{expanded ? commentary : shortCommentary}</p>
          {commentary.length > 60 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1.5 text-blue-500 hover:text-blue-400 transition-colors"
            >
              {expanded ? <><ChevronUp size={11} /> 收起</> : <><ChevronDown size={11} /> 展開全文</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const HistoryChart = ({ ticker, user }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' or ticker

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getAnalysisHistory(user.user_id, 50).then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px] gap-3">
        <LogIn size={40} className="opacity-20" />
        <p className="text-sm">登入後可查看<br />AI 分析紀錄</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-500 gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">載入紀錄中...</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
        <Clock size={40} className="mb-3 opacity-20" />
        <p className="text-sm">尚無分析紀錄<br />查詢股票後自動儲存</p>
      </div>
    );
  }

  // Get unique tickers for filter
  const tickers = [...new Set(records.map(r => r.ticker))];
  const filtered = filter === 'all' ? records : records.filter(r => r.ticker === filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium">AI 分析紀錄</span>
        <span className="text-xs text-slate-600">{records.length} 筆</span>
      </div>

      {/* Ticker Filter */}
      {tickers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            全部
          </button>
          {tickers.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {getTickerShort(t)}
            </button>
          ))}
        </div>
      )}

      {/* Records */}
      <div className="flex flex-col gap-3">
        {filtered.map(record => (
          <RecordCard key={record.id} record={record} />
        ))}
      </div>
    </div>
  );
};

export default HistoryChart;
