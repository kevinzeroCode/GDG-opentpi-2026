import React, { useState, useEffect, useRef } from 'react';
import useDifyAPI from './hooks/useDifyAPI';
import GaugeChart from './components/Dashboard/GaugeChart';
import { Send, Bot, User, TrendingUp, BarChart3 } from 'lucide-react';

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', content: '您好！我是您的量化分析助手。請輸入台股代碼（如：2330），我將為您解析即時數據。' }
  ]);
  const { fetchStockAnalysis, analysisResult, loading, error } = useDifyAPI();
  const scrollRef = useRef(null);

  // 自動捲動到底部
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

  // 當 API 有結果時，自動加入 Bot 對話
  useEffect(() => {
    if (analysisResult) {
      setMessages(prev => [...prev, { role: 'bot', content: analysisResult.rawText }]);
    }
  }, [analysisResult]);

  const metrics = analysisResult?.metrics;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* 左側：對話區域 */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
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
          <div ref={scrollRef} />
        </div>

        {error && <div className="mx-6 my-2 p-3 bg-red-900/20 border border-red-500/50 text-red-400 rounded-lg text-xs">{error}</div>}

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

      {/* 右側：量化監控面板 (Desktop Only) */}
      <div className="w-[400px] bg-slate-900/50 p-6 flex flex-col gap-6 overflow-y-auto">
        <h3 className="text-slate-400 font-bold flex items-center gap-2 uppercase tracking-wider text-sm">
          <BarChart3 size={18} /> 即時量化數據
        </h3>

        {metrics ? (
          <>
            {/* 指標卡片群 */}
            <div className="grid grid-cols-2 gap-4">
              <MetricBox label="目前價格" value={`$${metrics.price.toFixed(2)}`} subValue="Real-time" />
              <MetricBox label="MA5 均線" value={metrics.ma5.toFixed(2)} />
              <div className="col-span-2 p-4 bg-slate-800/50 border border-slate-700 rounded-2xl flex justify-between items-center">
                <span className="text-slate-400 text-sm">趨勢判斷</span>
                <span className={`flex items-center gap-1 font-bold ${metrics.trend === '多頭' ? 'text-red-500' : 'text-green-500'}`}>
                  <TrendingUp size={16} /> {metrics.trend}
                </span>
              </div>
            </div>

            {/* 儀表板 */}
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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center">
            <BarChart3 size={48} className="mb-4 opacity-20" />
            <p className="text-sm">尚未有分析數據<br/>請於左側輸入代號開始</p>
          </div>
        )}
      </div>
    </div>
  );
}

// 內部組件：小型數據框
const MetricBox = ({ label, value, subValue }) => (
  <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
    <div className="text-slate-500 text-xs mb-1 font-medium">{label}</div>
    <div className="text-xl font-bold font-mono text-slate-100">{value}</div>
    {subValue && <div className="text-[10px] text-slate-600">{subValue}</div>}
  </div>
);

export default App;