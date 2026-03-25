import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import useDifyAPI from './hooks/useDifyAPI';
import useAuth from './hooks/useAuth';
import useTWSELive from './hooks/useTWSELive';
import GaugeChart from './components/Dashboard/GaugeChart';
import KDChart from './components/Dashboard/KDChart';
import MACDChart from './components/Dashboard/MACDChart';
import HistoryChart from './components/Dashboard/HistoryChart';
import PriceChart from './components/Dashboard/PriceChart';
import CandlestickChart from './components/Dashboard/CandlestickChart';
import { Send, Bot, User, TrendingUp, BarChart3, Activity, Clock, Loader2, RefreshCw, Download, Star, X, Bell, Plus, Trash2, LogIn, LogOut, Shield } from 'lucide-react';
import Chart from 'react-apexcharts';
import { getWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, updateShares, updateAvgCost, syncWatchlistFromPlatform } from './utils/watchlist';
import { getHistory } from './utils/history';
import { getAlerts, saveAlert, removeAlert, checkAlerts, markAlertFired, resetAlert } from './utils/alerts';
import { getAlertEmail, setAlertEmail, sendAlertEmail } from './utils/emailAlert';
import { fetchTWSELive } from './utils/twseLive';
import { getTickerLabel, getTickerShort, resolveToTicker } from './utils/tickerNames';
import { generateCommentary } from './utils/commentary';

function App() {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState([
    { role: 'bot', content: '您好！我是您的量化分析助手。請輸入台股代碼（如：2330），我將為您解析即時數據。' }
  ]);
  const { fetchStockAnalysis, analysisResult, loading, error, lastTicker, retry, clearHistory } = useDifyAPI();
  const { user, isLoggedIn, appToken, dgrToken, register, login, logout, authLoading, authError } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const scrollRef = useRef(null);
  const dashboardRef = useRef(null);
  const [, watchlistTick] = useState(0);
  const watchlist = getWatchlist();
  const [, alertTick] = useState(0);
  const alerts = getAlerts();
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [recentTickers, setRecentTickers] = useState([]);

  const toggleWatchlist = (ticker) => {
    if (isInWatchlist(ticker)) removeFromWatchlist(ticker);
    else addToWatchlist(ticker);
    watchlistTick((n) => n + 1);
  };

  const batchQuery = async () => {
    for (const item of watchlist) {
      setMessages(prev => [...prev, { role: 'user', content: item.ticker }]);
      await fetchStockAnalysis(item.ticker, appToken);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const ok = await login(loginForm.email, loginForm.password);
    if (ok) {
      setShowLoginModal(false);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `✅ 已登入。歡迎回來！`
      }]);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const ok = await register(registerForm.username, registerForm.email, registerForm.password);
    if (ok) {
      setShowLoginModal(false);
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `✅ 帳號已建立並登入（${registerForm.username}）。歡迎使用 QuantDashboard AI！`
      }]);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
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

    await fetchStockAnalysis(resolveToTicker(userQuery), appToken);
  };

  useEffect(() => {
    if (analysisResult) {
      const commentary = analysisResult.commentary
        || generateCommentary(lastTicker, analysisResult.metrics)
        || analysisResult.rawText;
      setMessages(prev => [...prev, { role: 'bot', content: commentary }]);
      // Update recent tickers list
      if (lastTicker) {
        setRecentTickers(prev => [lastTicker, ...prev.filter(t => t !== lastTicker)].slice(0, 5));
      }
      // Check alerts (only for stock queries with real metrics)
      if (analysisResult.metrics && lastTicker) {
        const hits = checkAlerts(lastTicker, analysisResult.metrics);
        if (hits.length > 0) {
          setTriggeredAlerts(hits);
          hits.forEach((h) => {
            markAlertFired(h.id);
            alertTick((n) => n + 1);
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('QuantDashboard 警報', { body: h.message });
            }
            sendAlertEmail(lastTicker, h.message);
          });
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

  // Request notification permission on mount + 同步自選股從中台
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    syncWatchlistFromPlatform(sessionStorage.getItem('app_token')).then(() => watchlistTick((n) => n + 1));
  }, []);

  const handleAddAlert = (ticker, indicator, operator, value) => {
    if (!ticker) return;
    saveAlert({ ticker, indicator, operator, value: Number(value) });
    alertTick((n) => n + 1);
  };

  const handleRemoveAlert = (id) => {
    removeAlert(id);
    alertTick((n) => n + 1);
  };

  const handleResetAlert = (id) => {
    resetAlert(id);
    alertTick((n) => n + 1);
  };

  const metrics = analysisResult?.metrics;
  const { data: liveData, error: liveError } = useTWSELive(lastTicker);

  const [alertServiceStatus, setAlertServiceStatus] = useState('ok'); // 'ok' | 'error'

  // 背景自動輪詢：每 2 秒對所有有 PRICE 警報的股票查詢即時價格並比對
  useEffect(() => {
    const runCheck = async () => {
      const active = getAlerts().filter((a) => a.enabled && !a.firedAt && a.indicator === 'price');
      const tickers = [...new Set(active.map((a) => a.ticker))];
      if (tickers.length === 0) return;
      let anyError = false;
      for (const t of tickers) {
        try {
          const live = await fetchTWSELive(t);
          if (!live?.last) continue;
          setAlertServiceStatus('ok');
          const hits = checkAlerts(t, { price: live.last });
          if (hits.length > 0) {
            setTriggeredAlerts((prev) => [...prev, ...hits]);
            hits.forEach((h) => {
              markAlertFired(h.id);
              alertTick((n) => n + 1);
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('QuantDashboard 警報', { body: h.message });
              }
              sendAlertEmail(t, h.message);
            });
          }
        } catch {
          anyError = true;
        }
      }
      if (anyError) setAlertServiceStatus('error');
    };
    runCheck();
    const id = setInterval(runCheck, 2000);
    return () => clearInterval(id);
  }, []);

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
          <div className="flex-1">
            <h1 className="font-bold text-lg">Quant AI Assistant</h1>
            <div className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 在線分析中
            </div>
          </div>
          {/* Auth Status */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700/50 rounded-lg px-2.5 py-1 text-xs text-emerald-400">
                <Shield size={12} />
                <span>{user?.username}</span>
              </div>
              <button onClick={handleLogout} title="登出"
                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button onClick={() => { setShowLoginModal(true); setAuthTab('login'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700/50 hover:bg-blue-700 border border-blue-600/50 text-xs text-blue-300 hover:text-white transition-colors">
              <LogIn size={13} />
              登入 / 註冊
            </button>
          )}
        </header>

        {/* Auth Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-80 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={18} className="text-blue-400" />
                <h2 className="font-semibold text-base">帳號驗證</h2>
                <button onClick={() => setShowLoginModal(false)} className="ml-auto text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl mb-4">
                <button
                  onClick={() => setAuthTab('login')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${authTab === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  登入
                </button>
                <button
                  onClick={() => setAuthTab('register')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${authTab === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  註冊
                </button>
              </div>

              {authTab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-3">
                  <input
                    type="email"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="Email"
                    value={loginForm.email}
                    onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                    autoComplete="email"
                  />
                  <input
                    type="password"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="密碼"
                    value={loginForm.password}
                    onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                  {authError && <p className="text-xs text-red-400">{authError}</p>}
                  <button type="submit" disabled={authLoading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    {authLoading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                    {authLoading ? '登入中...' : '登入'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <input
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="帳號（至少 2 個字元）"
                    value={registerForm.username}
                    onChange={e => setRegisterForm(p => ({ ...p, username: e.target.value }))}
                    autoComplete="username"
                  />
                  <input
                    type="email"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="Email"
                    value={registerForm.email}
                    onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                    autoComplete="email"
                  />
                  <input
                    type="password"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    placeholder="密碼（至少 6 個字元）"
                    value={registerForm.password}
                    onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                    autoComplete="new-password"
                  />
                  {authError && <p className="text-xs text-red-400">{authError}</p>}
                  <button type="submit" disabled={authLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    {authLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {authLoading ? '建立中...' : '建立帳號'}
                  </button>
                </form>
              )}
              <p className="text-xs text-slate-500 mt-3 text-center">登入後自選股與分析記錄將與帳號同步</p>
            </div>
          </div>
        )}

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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-slate-400 font-bold flex items-center gap-2 uppercase tracking-wider text-sm">
              <BarChart3 size={18} /> 即時量化數據
              {lastTicker && (
                <span className="text-blue-400 normal-case font-mono text-sm">{lastTicker}</span>
              )}
            </h3>
            {metrics && (
              <button onClick={handleExport} className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors">
                <Download size={14} /> 匯出
              </button>
            )}
          </div>
          {recentTickers.length > 1 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {recentTickers.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setMessages(prev => [...prev, { role: 'user', content: t }]);
                    fetchStockAnalysis(t);
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full font-mono transition-colors ${
                    t === lastTicker
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
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
              onAvgCostChange={(ticker, cost) => { updateAvgCost(ticker, cost); watchlistTick((n) => n + 1); }}
            />
          ) : activeTab === 2 ? (
            <HistoryChart ticker={lastTicker} />
          ) : activeTab === 1 ? (
            <div className="flex flex-col gap-4">
              {/* KD / MACD / 綜合訊號：有資料才顯示 */}
              {metrics && (
                <>
                  <KDChart k={metrics.k} d={metrics.d} />
                  <MACDChart macd={metrics.macd} signal={metrics.signal} histogram={metrics.histogram} />
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
                </>
              )}
              {/* 警示面板：永遠顯示 */}
              <AlertPanel
                ticker={lastTicker}
                alerts={alerts}
                triggeredAlerts={triggeredAlerts}
                serviceStatus={alertServiceStatus}
                onAdd={handleAddAlert}
                onRemove={handleRemoveAlert}
                onReset={handleResetAlert}
              />
            </div>
          ) : metrics ? (
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

              {/* Live Price Card */}
              <LivePriceCard data={liveData} error={liveError} />

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

              {/* Candlestick Chart */}
              <CandlestickChart ticker={lastTicker} liveData={liveData} />
            </div>
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

const AlertPanel = ({ ticker, alerts, triggeredAlerts, serviceStatus, onAdd, onRemove, onReset }) => {
  const [alertTicker, setAlertTicker] = useState(ticker || '');
  const [indicator, setIndicator] = useState('rsi');
  const [operator, setOperator] = useState('>');
  const [value, setValue] = useState('');
  const [email, setEmail] = useState(getAlertEmail());
  const [emailSaved, setEmailSaved] = useState(false);

  // 當外部 ticker 更新時同步
  React.useEffect(() => { if (ticker) setAlertTicker(ticker); }, [ticker]);

  const handleSaveEmail = () => {
    setAlertEmail(email);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2000);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={14} className="text-amber-400" />
        <span className="text-xs text-slate-400 uppercase font-medium">智慧警報</span>
      </div>

      {/* Service status warning */}
      {serviceStatus === 'error' && (
        <div className="mb-3 flex items-center gap-1.5 text-xs bg-red-900/30 border border-red-700/50 text-red-400 px-3 py-1.5 rounded-lg">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
          即時報價服務暫時無法連線，警報暫停偵測
        </div>
      )}

      {/* Email input */}
      <div className="flex items-center gap-1.5 mb-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="輸入警報信箱..."
          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-amber-500 placeholder:text-slate-500"
        />
        <button
          onClick={handleSaveEmail}
          className={`text-xs px-2 py-1 rounded-lg transition-colors font-medium ${emailSaved ? 'bg-green-600 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
        >
          {emailSaved ? '已儲存' : '儲存'}
        </button>
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
      <div className="flex items-center gap-1.5 mb-1">
        <input
          value={alertTicker}
          onChange={(e) => setAlertTicker(e.target.value.toUpperCase())}
          placeholder="代號"
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-16 font-mono"
        />
        <select value={indicator} onChange={(e) => setIndicator(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none flex-1">
          {INDICATORS.map((ind) => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <select value={operator} onChange={(e) => setOperator(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-16">
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
          <option value="=">=</option>
        </select>
        <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="值"
          className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none flex-1" />
        <button
          onClick={() => { if (value && alertTicker) { onAdd(alertTicker, indicator, operator, value); setValue(''); } }}
          className="bg-amber-600 hover:bg-amber-500 text-white p-1 rounded-lg transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* All alerts grouped by ticker */}
      {alerts.length === 0 ? (
        <p className="text-[10px] text-slate-600">尚未設定任何警報</p>
      ) : (
        <div className="space-y-2">
          {/* Group by ticker */}
          {[...new Set(alerts.map((a) => a.ticker))].map((t) => (
            <div key={t}>
              <div className="text-[10px] text-slate-500 font-medium mb-1">{t}</div>
              {alerts.filter((a) => a.ticker === t).map((a) => (
                <div key={a.id} className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg mb-1 ${a.firedAt ? 'bg-slate-900/30 text-slate-600' : 'bg-slate-900/50 text-slate-400'}`}>
                  <div className="flex items-center gap-1.5">
                    {a.firedAt && <span className="text-[9px] text-amber-500 border border-amber-700/50 rounded px-1">已觸發</span>}
                    <span>{a.indicator.toUpperCase()} {a.operator} {a.value}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {a.firedAt && (
                      <button onClick={() => { onReset(a.id); }} className="text-[9px] text-blue-500 hover:text-blue-400 px-1">重設</button>
                    )}
                    <button onClick={() => onRemove(a.id)} className="text-slate-600 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WatchlistTab = ({ watchlist, loading, onBatchQuery, onToggle, onSetInput, onSharesChange, onAvgCostChange }) => {
  const [livePrices, setLivePrices] = useState({});
  const [liveLoading, setLiveLoading] = useState(false);

  // 每 30 秒自動抓取所有自選股即時價格
  useEffect(() => {
    if (!watchlist.length) return;
    const fetchAll = async () => {
      setLiveLoading(true);
      const results = {};
      for (const item of watchlist) {
        try {
          const live = await fetchTWSELive(item.ticker);
          if (live) results[item.ticker] = live;
        } catch { /* 盤後或查無資料時靜默忽略 */ }
      }
      setLivePrices(results);
      setLiveLoading(false);
    };
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [watchlist.map((w) => w.ticker).join(',')]);

  // 合併 live 價格與歷史快取
  const portfolio = watchlist.map((item) => {
    const live = livePrices[item.ticker];
    const hist = getHistory(item.ticker);
    const latest = hist.length > 0 ? hist[hist.length - 1].metrics : null;
    const price = live?.last ?? latest?.price ?? 0;
    const prevClose = live?.prevClose ?? null;
    const changePercent = prevClose && price ? ((price - prevClose) / prevClose) * 100 : null;
    const value = item.shares * price;
    const cost = item.avgCost > 0 ? item.avgCost * item.shares : 0;
    const pnl = cost > 0 ? value - cost : null;
    const pnlPct = cost > 0 && item.avgCost > 0 ? ((price - item.avgCost) / item.avgCost) * 100 : null;
    return { ...item, latest, price, prevClose, changePercent, value, pnl, pnlPct, isLive: !!live };
  });

  const holdingItems = portfolio.filter((p) => p.shares > 0 && p.price > 0);
  const totalAsset = holdingItems.reduce((sum, p) => sum + p.value, 0);
  const totalCost = holdingItems.reduce((sum, p) => sum + (p.avgCost > 0 ? p.avgCost * p.shares : 0), 0);
  const totalPnl = totalCost > 0 ? totalAsset - totalCost : null;

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
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm font-medium">自選清單 ({watchlist.length})</span>
          {liveLoading && <span className="text-[10px] text-slate-600">更新中…</span>}
          {!liveLoading && Object.keys(livePrices).length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 即時
            </span>
          )}
        </div>
        {watchlist.length > 0 && (
          <button onClick={onBatchQuery} disabled={loading} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 全部查詢
          </button>
        )}
      </div>

      {/* Total Asset + P&L */}
      {totalAsset > 0 && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-2xl p-4 text-center">
          <div className="text-xs text-blue-400 uppercase font-medium mb-1">投資組合總市值</div>
          <div className="text-2xl font-bold font-mono text-blue-300">
            ${totalAsset.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          {totalPnl !== null && (
            <div className={`text-xs font-medium mt-1 ${totalPnl >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              未實現損益 {totalPnl >= 0 ? '▲' : '▼'} ${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {totalCost > 0 && ` (${((totalPnl / totalCost) * 100).toFixed(2)}%)`}
            </div>
          )}
        </div>
      )}

      {/* Pie Chart */}
      {holdingItems.length >= 2 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
          <div className="text-xs text-slate-500 uppercase mb-2 font-medium">持股配比</div>
          <Chart options={pieOptions} series={pieSeries} type="pie" height={200} />
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
          <Star size={48} className="mb-4 opacity-20" />
          <p className="text-sm">尚無自選股票<br />在總覽頁點擊星號加入</p>
        </div>
      ) : (
        portfolio.map((p) => {
          const isUp = p.changePercent !== null && p.changePercent >= 0;
          return (
            <div key={p.ticker} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200">{getTickerLabel(p.ticker)}</span>
                    {p.price > 0 && (
                      <span className={`text-xs font-mono font-bold ${p.changePercent !== null ? (isUp ? 'text-red-400' : 'text-green-400') : 'text-slate-400'}`}>
                        ${p.price.toFixed(2)}
                        {p.changePercent !== null && (
                          <span className="ml-1 text-[10px]">{isUp ? '▲' : '▼'}{Math.abs(p.changePercent).toFixed(2)}%</span>
                        )}
                      </span>
                    )}
                  </div>
                  {p.latest && !p.isLive && (
                    <div className="flex gap-3 mt-0.5 text-[10px] text-slate-600">
                      <span>RSI {p.latest.rsi}</span>
                      <span>{p.latest.trend}</span>
                      <span className="italic">歷史快取</span>
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

              {/* Shares + avgCost + P&L */}
              <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-10">持股</span>
                  <input
                    type="number" min="0" value={p.shares || ''} placeholder="0"
                    onChange={(e) => onSharesChange(p.ticker, e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500 w-20 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">股</span>
                  {p.shares > 0 && p.price > 0 && (
                    <span className="text-[10px] text-slate-400 ml-auto font-mono">
                      市值 ${p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-10">成本</span>
                  <input
                    type="number" min="0" step="0.01" value={p.avgCost || ''} placeholder="均價"
                    onChange={(e) => onAvgCostChange(p.ticker, e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-amber-500 w-20 font-mono"
                  />
                  <span className="text-[10px] text-slate-600">元</span>
                  {p.pnlPct !== null && (
                    <span className={`text-[10px] ml-auto font-mono font-bold ${p.pnlPct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {p.pnlPct >= 0 ? '▲' : '▼'}{Math.abs(p.pnlPct).toFixed(2)}%
                      {p.pnl !== null && ` (${p.pnl >= 0 ? '+' : ''}${Math.round(p.pnl).toLocaleString()})`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

const LivePriceCard = ({ data, error }) => {
  if (error) return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-3 text-center text-[11px] text-slate-500">
      {error}
    </div>
  );
  if (!data) return null;
  const change = data.last && data.prevClose
    ? ((data.last - data.prevClose) / data.prevClose) * 100
    : null;
  const isUp = change !== null && change >= 0;
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 uppercase font-medium">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          即時行情
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">{data.date ? `${data.date.slice(0,4)}/${data.date.slice(4,6)}/${data.date.slice(6,8)}` : ''}</div>
          <div className="text-[10px] text-slate-600">{data.time}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">開盤價</div>
          <div className="text-lg font-bold font-mono text-slate-100">${data.open?.toFixed(2) ?? '-'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">最新成交</div>
          <div className={`text-lg font-bold font-mono ${change !== null ? (isUp ? 'text-red-400' : 'text-green-400') : 'text-slate-100'}`}>
            ${data.last?.toFixed(2) ?? '-'}
            {change !== null && (
              <span className="text-xs ml-1">{isUp ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">最高</div>
          <div className="text-sm font-mono text-red-400">${data.high?.toFixed(2) ?? '-'}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">最低</div>
          <div className="text-sm font-mono text-green-400">${data.low?.toFixed(2) ?? '-'}</div>
        </div>
      </div>
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
