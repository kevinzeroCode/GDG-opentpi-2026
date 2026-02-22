import React, { useState, useEffect, useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Loader2, RefreshCw, Database } from 'lucide-react';
import { fetchStockCandles, clearCandleCache, getCandleCacheInfo } from '../../utils/stockCandles';

const PERIODS = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '3Y', months: 36 },
  { label: '全部', months: null },
];

const CandlestickChart = ({ ticker }) => {
  const [allCandles, setAllCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('1Y');
  const [cacheInfo, setCacheInfo] = useState(null);

  const load = (t, forceRefresh = false) => {
    if (!t) return;
    if (forceRefresh) clearCandleCache(t);
    setLoading(true);
    setError(null);
    fetchStockCandles(t)
      .then((data) => {
        setAllCandles(data);
        setCacheInfo(getCandleCacheInfo(t));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setAllCandles([]);
    setCacheInfo(null);
    load(ticker);
  }, [ticker]);

  const candles = useMemo(() => {
    if (!allCandles.length) return [];
    const sel = PERIODS.find((p) => p.label === period);
    if (!sel || sel.months === null) return allCandles;
    const cutoff = Date.now() - sel.months * 30 * 24 * 60 * 60 * 1000;
    return allCandles.filter((c) => c.x >= cutoff);
  }, [allCandles, period]);

  if (!ticker) return null;

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center h-52 gap-3">
        <Loader2 size={22} className="animate-spin text-slate-500" />
        <span className="text-xs text-slate-500">載入 K 線資料中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center h-32 gap-2 text-center">
        <span className="text-xs text-slate-500">{error}</span>
        <button
          onClick={() => load(ticker)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 px-3 py-1 bg-slate-700 rounded-lg transition-colors"
        >
          <RefreshCw size={12} /> 重試
        </button>
      </div>
    );
  }

  if (!candles.length) return null;

  const candleData = candles.map((c) => ({ x: c.x, y: [c.o, c.h, c.l, c.c] }));

  // Latest candle stats
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const change = prev ? ((last.c - prev.c) / prev.c) * 100 : 0;
  const isUp = change >= 0;

  const options = {
    chart: {
      background: 'transparent',
      toolbar: {
        show: true,
        tools: {
          download: false,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
        autoSelected: 'zoom',
      },
      zoom: { enabled: true, type: 'x' },
      animations: { enabled: false },
    },
    theme: { mode: 'dark' },
    grid: { borderColor: '#334155', strokeDashArray: 3 },
    plotOptions: {
      candlestick: {
        colors: { upward: '#22c55e', downward: '#ef4444' },
        wick: { useFillColor: true },
      },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        datetimeFormatter: { year: 'yyyy', month: "MMM 'yy", day: 'dd MMM' },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        formatter: (val) => `$${val?.toFixed(0)}`,
      },
      tooltip: { enabled: true },
    },
    tooltip: {
      theme: 'dark',
      x: { format: 'yyyy/MM/dd' },
      custom: ({ dataPointIndex, w }) => {
        const d = w.globals.seriesCandleO;
        if (!d) return '';
        const o = w.globals.seriesCandleO[0][dataPointIndex];
        const h = w.globals.seriesCandleH[0][dataPointIndex];
        const l = w.globals.seriesCandleL[0][dataPointIndex];
        const c = w.globals.seriesCandleC[0][dataPointIndex];
        const color = c >= o ? '#22c55e' : '#ef4444';
        return `
          <div style="padding:8px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;font-size:12px;color:#94a3b8;min-width:120px;line-height:1.7;">
            <div style="color:${color};font-weight:bold;margin-bottom:4px;">${c >= o ? '▲' : '▼'} $${c?.toFixed(2)}</div>
            <div>開 <span style="color:#e2e8f0;float:right;margin-left:12px;">$${o?.toFixed(2)}</span></div>
            <div>高 <span style="color:#22c55e;float:right;margin-left:12px;">$${h?.toFixed(2)}</span></div>
            <div>低 <span style="color:#ef4444;float:right;margin-left:12px;">$${l?.toFixed(2)}</span></div>
            <div>收 <span style="color:#e2e8f0;float:right;margin-left:12px;">$${c?.toFixed(2)}</span></div>
          </div>`;
      },
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 uppercase font-medium">K 線圖</span>
            {cacheInfo && (
              <span className="flex items-center gap-0.5 text-[10px] text-slate-600" title={`快取：${cacheInfo.count} 筆 · ${cacheInfo.sizeKB} KB · 更新於 ${cacheInfo.fetchedAt}`}>
                <Database size={10} /> {cacheInfo.sizeKB}KB
              </span>
            )}
          </div>
          {last && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold font-mono text-slate-200">${last.c.toFixed(2)}</span>
              <span className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPeriod(p.label)}
                className={`text-[10px] px-2 py-0.5 rounded-md transition-colors font-medium ${
                  period === p.label
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(ticker, true)}
            title="清除快取並重新下載"
            className="text-slate-600 hover:text-blue-400 transition-colors p-0.5"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <Chart
        options={options}
        series={[{ name: 'K線', data: candleData }]}
        type="candlestick"
        height={240}
      />

      <div className="flex gap-4 mt-1 text-[10px] text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />收漲</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />收跌</span>
        <span className="ml-auto">可滾輪縮放 · 拖曳平移</span>
      </div>
    </div>
  );
};

export default CandlestickChart;
