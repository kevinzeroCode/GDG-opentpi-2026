import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import useDifyAPI from './hooks/useDifyAPI';
import GaugeChart from './components/Dashboard/GaugeChart';
import KDChart from './components/Dashboard/KDChart';
import MACDChart from './components/Dashboard/MACDChart';
import HistoryChart from './components/Dashboard/HistoryChart';
import PriceChart from './components/Dashboard/PriceChart';
import { Send, Bot, User, TrendingUp, BarChart3, Activity, Clock, Loader2, RefreshCw, Download, Star, X, Bell, Plus, Trash2 } from 'lucide-react';
import Chart from 'react-apexcharts';
import { getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, updateShares } from './utils/watchlist';
import { getHistory } from './utils/history';
import { getAlerts, saveAlert, removeAlert, checkAlerts } from './utils/alerts';
import { getTickerLabel, getTickerShort } from './utils/tickerNames';
import { generateCommentary } from './utils/commentary';

function App() {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState([
    { role: 'bot', content: '您好！我是您的量化分析助手。請輸入台股代碼（如：2330），我將為您解析即時數據。' }
  ]);
  const { fetchStockAnalysis, analysisResult, loading, error, lastTicker, retry } = useDifyAPI();
  const scrollRef = useRef(null);
  const dashboardRef = useRef(null);
  const [, watchlistTick] = useState(0);
  const watchlist = getWatchlist();
  const [, alertTick] = useState(0);
  const alerts = getAlerts();
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);

  const toggleWatchlist = (ticker) => {
    if (isInWatchlist(ticker)) removeFromWatchlist(ticker);
    else addToWatchlist(ticker);
    watchlistTick((n) => n + 1);
  };

  const batchQuery = async () => {
    for (const item of watchlist) {
      setMessages(prev => [...prev, { role: 'user', content: item.ticker }]);
      await fetchStockAnalysis(item.ticker);
    }
  };

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    const canvas = await html2canvas(dashboardRef.current, { backgroundColor: '#0f172a' });
    const link = document.createElement('a');
    link.download = `quant-${lastTicker || 'report'}-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userQuery = input;
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setInput('');

    await fetchStockAnalysis(userQuery);
  };

  useEffect(() => {
    if (analysisResult) {
      const commentary = generateCommentary(lastTicker, analysisResult.metrics) || analysisResult.rawText;
      setMessages(prev => [...prev, { role: 'bot', content: commentary }]);
      // Check alerts
      if (analysisResult.metrics && lastTicker) {
        const hits = checkAlerts(lastTicker, analysisResult.metrics);
        if (hits.length > 0) {
          setTriggeredAlerts(hits);
          if ('Notification' in window && Notification.permission === 'granted') {
            hits.forEach((h) => new Notification('QuantDashboard 警報', { body: h.message }));
          }
        }
      }
    }
  }, [analysisResult]);

  // Show errors as bot messages in chat
  useEffect(() => {
    if (error) {
      setMessages(prev => [...prev, { role: 'bot', content: `抱歉，查詢時遇到問題：\n${error}\n\n請確認代碼是否正確，或點擊下方「重試」按鈕。` }]);
    }
  }, [error]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleAddAlert = (indicator, operator, value) => {
    if (!lastTicker) return;
    saveAlert({ ticker: lastTicker, indicator, operator, value: Number(value) });
    alertTick((n) => n + 1);
  };

  const handleRemoveAlert = (id) => {
    removeAlert(id);
    alertTick((n) => n + 1);
  };

  const metrics = analysisResult?.metrics;

  const getCompositeSignal = () => {
    if (!metrics) return null;
    let bullish = 0;
    let bearish = 0;

    // RSI
    if (metrics.rsi > 70) bearish++;
    else if (metrics.rsi < 30) bullish++;

    // KD
    if (metrics.k !== null && metrics.d !== null) {
      if (metrics.k > 80) bearish++;
      else if (metrics.k < 20) bullish++;
      if (metrics.k > metrics.d) bullish++;
      else bearish++;
    }

    // MACD
    if (metrics.macd !== null && metrics.signal !== null) {
      if (metrics.macd > metrics.signal) bullish++;
      else bearish++;
      if (metrics.histogram > 0) bullish++;
      else bearish++;
    }

    if (bullish > bearish + 1) return { text: '偏多 — 買入訊號', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    if (bearish > bullish + 1) return { text: '偏空 — 賣出訊號', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    return { text: '中性 — 觀望', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
  };

  const tabs = [
    { label: '總覽', icon: <BarChart3 size={14} /> },
    { label: '技術指標', icon: <Activity size={14} /> },
    { label: '歷史趨勢', icon: <Clock size={14} /> },
    { label: '自選', icon: <Star size={14} /> },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">

      {/* Left: Chat Area */}
      <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 min-h-0">
        <header className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Bot size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Quant AI Assistant</h1>
            <div className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 在線分析中
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-900/50'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-blue-400" />}
                </div>
                <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 rounded-tl-none'}`}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-blue-900/50">
                  <Bot size={16} className="text-blue-400" />
                </div>
                <div className="p-4 rounded-2xl rounded-tl-none bg-slate-800 border border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>分析中...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {error && (
          <div className="mx-6 my-2 p-3 bg-red-900/20 border border-red-500/50 text-red-400 rounded-lg text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={retry} className="flex items-center gap-1 ml-3 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-md transition-colors text-red-300 flex-shrink-0">
              <RefreshCw size={12} /> 重試
            </button>
          </div>
        )}

        <div className="p-6 bg-slate-900/30">
          <div className="relative max-w-3xl mx-auto">
            <input
              className="w-full bg-slate-800 border border-slate-700 p-4 pr-16 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
              placeholder="輸入股票代號或指令..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 rounded-xl transition-colors shadow-lg"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Dashboard Panel */}
      <div className="w-full md:w-[400px] bg-slate-900/50 flex flex-col overflow-hidden min-h-[40vh] md:min-h-0">
        {/* Tab Header */}
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 font-bold flex items-center gap-2 uppercase tracking-wider text-sm">
              <BarChart3 size={18} /> 即時量化數據
            </h3>
            {metrics && (
              <button onClick={handleExport} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors">
                <Download size={14} /> 匯出
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl">
            {tabs.map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === i
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div ref={dashboardRef} className="flex-1 overflow-y-auto p-4 pt-4">
          {activeTab === 3 ? (
            <WatchlistTab
              watchlist={watchlist}
              loading={loading}
              onBatchQuery={batchQuery}
              onToggle={toggleWatchlist}
              onSetInput={setInput}
              onSharesChange={(ticker, shares) => { updateShares(ticker, shares); watchlistTick((n) => n + 1); }}
            />
          ) : activeTab === 2 ? (
            <HistoryChart ticker={lastTicker} />
          ) : metrics ? (
            <>
              {activeTab === 0 && (
                <div className="flex flex-col gap-4">
                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl relative">
                      <div className="text-slate-500 text-xs mb-1 font-medium">目前價格</div>
                      <div className="text-xl font-bold font-mono text-slate-100">${metrics.price.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-600">Real-time</div>
                      {lastTicker && (
                        <button onClick={() => toggleWatchlist(lastTicker)} className="absolute top-3 right-3">
                          <Star size={14} className={isInWatchlist(lastTicker) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600 hover:text-yellow-400'} />
                        </button>
                      )}
                    </div>
                    <MetricBox label="MA5 均線" value={metrics.ma5.toFixed(2)} />
                    <div className="col-span-2 p-4 bg-slate-800/50 border border-slate-700 rounded-2xl flex justify-between items-center">
                      <span className="text-slate-400 text-sm">趨勢判斷</span>
                      <span className={`flex items-center gap-1 font-bold ${metrics.trend === '多頭' ? 'text-red-500' : 'text-green-500'}`}>
                        <TrendingUp size={16} /> {metrics.trend}
                      </span>
                    </div>
                  </div>

                  {/* RSI Gauge */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 flex flex-col items-center shadow-inner">
                    <span className="text-slate-400 text-sm mb-2 font-medium">RSI 強度分析</span>
                    <GaugeChart value={metrics.rsi} />
                    <div className="mt-4 flex gap-4 w-full">
                      <div className="flex-1 text-center border-r border-slate-700">
                        <div className="text-xs text-slate-500 uppercase">RSI Value</div>
                        <div className="text-xl font-mono font-bold text-blue-400">{metrics.rsi}</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-xs text-slate-500 uppercase">Status</div>
                        <div className={`text-sm font-bold mt-1 ${metrics.rsi > 70 ? 'text-red-400' : metrics.rsi < 30 ? 'text-green-400' : 'text-slate-300'}`}>
                          {metrics.rsi > 70 ? '超買' : metrics.rsi < 30 ? '超賣' : '中性'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price Chart */}
                  <PriceChart ticker={lastTicker} />
                </div>
              )}

              {activeTab === 1 && (
                <div className="flex flex-col gap-4">
                  {/* KD Chart */}
                  <KDChart k={metrics.k} d={metrics.d} />

                  {/* MACD Chart */}
                  <MACDChart macd={metrics.macd} signal={metrics.signal} histogram={metrics.histogram} />

                  {/* Composite Signal */}
                  {(() => {
                    const sig = getCompositeSignal();
                    if (!sig) return null;
                    return (
                      <div className={`p-4 rounded-2xl border ${sig.bg} ${sig.border}`}>
                        <div className="text-xs text-slate-500 uppercase mb-1 font-medium">綜合訊號</div>
                        <div className={`text-lg font-bold ${sig.color}`}>{sig.text}</div>
                        <div className="text-[10px] text-slate-500 mt-1">依據 RSI + KD + MACD 綜合分析</div>
                      </div>
                    );
                  })()}

                  {/* Alert Setup */}
                  <AlertPanel
                    ticker={lastTicker}
                    alerts={alerts}
                    triggeredAlerts={triggeredAlerts}
                    onAdd={handleAddAlert}
                    onRemove={handleRemoveAlert}
                  />
                </div>
              )}
            </>
          ) : loading ? (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl h-20" />
                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl h-20" />
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl h-12" />
              <div className="bg-slate-800/50 border border-slate-700 rounded-3xl h-48" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
              <BarChart3 size={48} className="mb-4 opacity-20" />
              <p className="text-sm">尚未有分析數據<br/>請於左側輸入代號開始</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const INDICATORS = [
  { value: 'rsi', label: 'RSI' },
  { value: 'k', label: 'K' },
  { value: 'd', label: 'D' },
  { value: 'macd', label: 'MACD' },
  { value: 'price', label: '價格' },
];

const AlertPanel = ({ ticker, alerts, triggeredAlerts, onAdd, onRemove }) => {
  const [indicator, setIndicator] = useState('rsi');
  const [operator, setOperator] = useState('>');
  const [value, setValue] = useState('');
  const tickerAlerts = alerts.filter((a) => a.ticker === ticker);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={14} className="text-amber-400" />
        <span className="text-xs text-slate-400 uppercase font-medium">智慧警報</span>
      </div>

      {/* Triggered alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="mb-3 space-y-1">
          {triggeredAlerts.map((t, i) => (
            <div key={i} className="text-xs bg-amber-900/30 border border-amber-700/50 text-amber-300 px-3 py-1.5 rounded-lg">
              {t.message}
            </div>
          ))}
        </div>
      )}

      {/* Add alert form */}
      <div className="flex items-center gap-1.5 mb-3">
        <select value={indicator} onChange={(e) => setIndicator(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none">
          {INDICATORS.map((ind) => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
        </select>
        <select value={operator} onChange={(e) => setOperator(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-12">
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
        </select>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="值"
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-16" />
        <button
          onClick={() => { if (value) { onAdd(indicator, operator, value); setValue(''); } }}
          className="bg-amber-600 hover:bg-amber-500 text-white p-1 rounded-lg transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Existing alerts */}
      {tickerAlerts.length === 0 ? (
        <p className="text-[10px] text-slate-600">尚未設定警報</p>
      ) : (
        <div className="space-y-1">
          {tickerAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/50 px-2 py-1 rounded-lg">
              <span>{a.indicator.toUpperCase()} {a.operator} {a.value}</span>
              <button onClick={() => onRemove(a.id)} className="text-slate-600 hover:text-red-400">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WatchlistTab = ({ watchlist, loading, onBatchQuery, onToggle, onSetInput, onSharesChange }) => {
  // Compute portfolio data
  const portfolio = watchlist.map((item) => {
    const hist = getHistory(item.ticker);
    const latest = hist.length > 0 ? hist[hist.length - 1].metrics : null;
    const price = latest?.price ?? 0;
    return { ...item, latest, price, value: item.shares * price };
  });

  const holdingItems = portfolio.filter((p) => p.shares > 0 && p.price > 0);
  const totalAsset = holdingItems.reduce((sum, p) => sum + p.value, 0);

  const pieOptions = {
    chart: { background: 'transparent' },
    labels: holdingItems.map((p) => getTickerShort(p.ticker)),
    colors: ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'],
    theme: { mode: 'dark' },
    legend: { position: 'bottom', labels: { colors: '#94a3b8' }, fontSize: '11px' },
    dataLabels: { style: { fontSize: '11px' } },
    stroke: { show: false },
    tooltip: {
      y: { formatter: (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
    },
  };
  const pieSeries = holdingItems.map((p) => Math.round(p.value));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <span className="text-slate-400 text-sm font-medium">自選清單 ({watchlist.length})</span>
        {watchlist.length > 0 && (
          <button onClick={onBatchQuery} disabled={loading} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 全部查詢
          </button>
        )}
      </div>

      {/* Total Asset */}
      {totalAsset > 0 && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-2xl p-4 text-center">
          <div className="text-xs text-blue-400 uppercase font-medium mb-1">投資組合總市值</div>
          <div className="text-2xl font-bold font-mono text-blue-300">
            ${totalAsset.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      )}

      {/* Pie Chart */}
      {holdingItems.length >= 2 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <div className="text-xs text-slate-500 uppercase mb-2 font-medium">持股配比</div>
          <Chart options={pieOptions} series={pieSeries} type="pie" height={220} />
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
          <Star size={48} className="mb-4 opacity-20" />
          <p className="text-sm">尚無自選股票<br />在總覽頁點擊星號加入</p>
        </div>
      ) : (
        portfolio.map((p) => (
          <div key={p.ticker} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-200">{getTickerLabel(p.ticker)}</span>
                  {p.latest && <span className="text-xs text-slate-500">${p.price.toFixed(2)}</span>}
                </div>
                {p.latest && (
                  <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                    <span>RSI {p.latest.rsi}</span>
                    <span className={p.latest.rsi > 70 ? 'text-red-400' : p.latest.rsi < 30 ? 'text-green-400' : ''}>
                      {p.latest.rsi > 70 ? '超買' : p.latest.rsi < 30 ? '超賣' : '中性'}
                    </span>
                    {p.latest.trend && <span>{p.latest.trend}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onSetInput(p.ticker)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">查詢</button>
                <button onClick={() => onToggle(p.ticker)} className="text-slate-600 hover:text-red-400 p-1">
                  <X size={14} />
                </button>
              </div>
            </div>
            {/* Shares input row */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500">持股</span>
              <input
                type="number"
                min="0"
                value={p.shares || ''}
                placeholder="0"
                onChange={(e) => onSharesChange(p.ticker, e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 w-20 font-mono"
              />
              <span className="text-[10px] text-slate-600">股</span>
              {p.shares > 0 && p.price > 0 && (
                <span className="text-[10px] text-slate-400 ml-auto font-mono">
                  = ${p.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const MetricBox = ({ label, value, subValue }) => (
  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
    <div className="text-slate-500 text-xs mb-1 font-medium">{label}</div>
    <div className="text-xl font-bold font-mono text-slate-100">{value}</div>
    {subValue && <div className="text-[10px] text-slate-600">{subValue}</div>}
  </div>
);

export default App;
