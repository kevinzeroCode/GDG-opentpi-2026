import React, { useState, useEffect, useMemo, useRef } from 'react';
import Chart from 'react-apexcharts';
import { Loader2, RefreshCw, Database } from 'lucide-react';
import { fetchStockCandles, clearCandleCache, getCandleCacheInfo } from '../../utils/stockCandles';

const PERIODS = [
  { label: '1D', days: 1 },
  { label: '1W', days: 7 },
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: '3Y', months: 36 },
  { label: '5Y', months: 60 },
];

const computeMA = (data, n) =>
  data.map((c, i) => ({
    x: c.x,
    y:
      i < n - 1
        ? null
        : parseFloat(
            (data.slice(i - n + 1, i + 1).reduce((s, a) => s + a.c, 0) / n).toFixed(2)
          ),
  }));

const fmtVol = (v) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v);

const CandlestickChart = ({ ticker, liveData }) => {
  const [allCandles, setAllCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('1Y');
  const [cacheInfo, setCacheInfo] = useState(null);
  const [visibleMAs, setVisibleMAs] = useState({ MA5: true, MA20: true, MA60: false });
  const toggleMA = (ma) => setVisibleMAs((prev) => ({ ...prev, [ma]: !prev[ma] }));

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

  // 用 ref 存 liveData，避免每 5 秒觸發 chart 重繪（重繪會重置縮放狀態）
  const liveDataRef = useRef(liveData);
  useEffect(() => { liveDataRef.current = liveData; }, [liveData]);

  const candles = useMemo(() => {
    if (!allCandles.length) return [];
    const sel = PERIODS.find((p) => p.label === period);
    let filtered;
    if (!sel || sel.months === null) {
      filtered = allCandles;
    } else if (sel.days !== undefined) {
      const cutoff = Date.now() - sel.days * 24 * 60 * 60 * 1000;
      filtered = allCandles.filter((c) => c.x >= cutoff);
    } else {
      filtered = allCandles.filter(
        (c) => c.x >= Date.now() - sel.months * 30 * 24 * 60 * 60 * 1000
      );
    }

    // 盤中：用即時行情補今日 K 棒（讀 ref，不加入 useMemo 依賴，避免 5 秒重繪）
    const live = liveDataRef.current;
    if (live?.open && live?.date) {
      const d = live.date;
      const todayTs = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`).getTime();
      const last = filtered[filtered.length - 1];
      if (!last || last.x < todayTs) {
        filtered = [
          ...filtered,
          { x: todayTs, o: live.open, h: live.high, l: live.low, c: live.last, v: 0 },
        ];
      }
    }
    return filtered;
  }, [allCandles, period]);

  // ── 穩定 memoized series（不因父層 5 秒 re-render 重置縮放）──
  const candleData = useMemo(
    () => candles.map((c) => ({ x: c.x, y: [c.o, c.h, c.l, c.c] })),
    [candles]
  );
  const volumeData = useMemo(() => candles.map((c) => ({ x: c.x, y: c.v ?? 0 })), [candles]);
  const ma5Data  = useMemo(() => computeMA(candles, 5),  [candles]);
  const ma20Data = useMemo(() => computeMA(candles, 20), [candles]);
  const ma60Data = useMemo(() => computeMA(candles, 60), [candles]);
  const maxVolume = useMemo(() => Math.max(...candles.map((c) => c.v ?? 0), 1), [candles]);

  const options = useMemo(
    () => ({
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
          colors: { upward: '#ef4444', downward: '#22c55e' },
          wick: { useFillColor: true },
        },
        bar: { columnWidth: '80%' },
      },
      // stroke[0]=candlestick, [1]=MA5, [2]=MA20, [3]=MA60, [4]=volume bar
      stroke: {
        width: [0, visibleMAs.MA5 ? 1.5 : 0, visibleMAs.MA20 ? 1.5 : 0, visibleMAs.MA60 ? 1.5 : 0, 0],
        curve: 'smooth',
      },
      colors: ['#94a3b8', '#facc15', '#60a5fa', '#f97316', '#334155'],
      legend: { show: false },
      xaxis: {
        type: 'datetime',
        labels: {
          style: { colors: '#64748b', fontSize: '10px' },
          datetimeFormatter: { year: 'yyyy', month: "MMM 'yy", day: 'dd MMM' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: [
        {
          // 主軸（K 線 + 均線）
          seriesName: 'K線',
          labels: {
            style: { colors: '#64748b', fontSize: '10px' },
            formatter: (val) => `$${val?.toFixed(0)}`,
          },
          tooltip: { enabled: true },
        },
        { seriesName: 'K線', show: false }, // MA5
        { seriesName: 'K線', show: false }, // MA20
        { seriesName: 'K線', show: false }, // MA60
        {
          // 成交量軸：max 放大 5 倍，讓 bar 只佔底部 20%
          seriesName: '成交量',
          opposite: true,
          show: false,
          min: 0,
          max: maxVolume * 5,
          labels: { show: false },
        },
      ],
      tooltip: {
        theme: 'dark',
        x: { format: 'yyyy/MM/dd' },
        shared: true,
        intersect: false,
        custom: ({ dataPointIndex, w }) => {
          const o = w.globals.seriesCandleO?.[0]?.[dataPointIndex];
          if (o == null) return '';
          const h = w.globals.seriesCandleH[0][dataPointIndex];
          const l = w.globals.seriesCandleL[0][dataPointIndex];
          const c = w.globals.seriesCandleC[0][dataPointIndex];
          const ma5  = w.globals.series[1]?.[dataPointIndex];
          const ma20 = w.globals.series[2]?.[dataPointIndex];
          const ma60 = w.globals.series[3]?.[dataPointIndex];
          const vol  = w.globals.series[4]?.[dataPointIndex];
          const color = c >= o ? '#ef4444' : '#22c55e';
          const maRow = (label, val, clr) =>
            val != null
              ? `<div>${label} <span style="color:${clr};float:right;margin-left:14px;">$${val.toFixed(2)}</span></div>`
              : '';
          return `
            <div style="padding:8px 12px;background:#1e293b;border:1px solid #334155;border-radius:8px;font-size:12px;color:#94a3b8;min-width:150px;line-height:1.75;">
              <div style="color:${color};font-weight:bold;margin-bottom:4px;">${c >= o ? '▲' : '▼'} $${c?.toFixed(2)}</div>
              <div>開 <span style="color:#e2e8f0;float:right;margin-left:14px;">$${o?.toFixed(2)}</span></div>
              <div>高 <span style="color:#ef4444;float:right;margin-left:14px;">$${h?.toFixed(2)}</span></div>
              <div>低 <span style="color:#22c55e;float:right;margin-left:14px;">$${l?.toFixed(2)}</span></div>
              <div>收 <span style="color:#e2e8f0;float:right;margin-left:14px;">$${c?.toFixed(2)}</span></div>
              ${maRow('MA5', ma5, '#facc15')}
              ${maRow('MA20', ma20, '#60a5fa')}
              ${maRow('MA60', ma60, '#f97316')}
              <div style="border-top:1px solid #334155;margin-top:4px;padding-top:4px;">量 <span style="color:#94a3b8;float:right;margin-left:14px;">${vol ? fmtVol(vol) : '-'}</span></div>
            </div>`;
        },
      },
    }),
    [maxVolume, visibleMAs]
  );

  const series = useMemo(
    () => [
      { name: 'K線',   type: 'candlestick', data: candleData },
      { name: 'MA5',   type: 'line',        data: ma5Data   },
      { name: 'MA20',  type: 'line',        data: ma20Data  },
      { name: 'MA60',  type: 'line',        data: ma60Data  },
      { name: '成交量', type: 'bar',         data: volumeData },
    ],
    [candleData, ma5Data, ma20Data, ma60Data, volumeData]
  );

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

  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const change = prev ? ((last.c - prev.c) / prev.c) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      {/* Header row 1: title + price + refresh */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 uppercase font-medium">K 線圖</span>
          {cacheInfo && (
            <span
              className="flex items-center gap-0.5 text-[10px] text-slate-600"
              title={`快取：${cacheInfo.count} 筆 · ${cacheInfo.sizeKB} KB · 更新於 ${cacheInfo.fetchedAt}`}
            >
              <Database size={10} /> {cacheInfo.sizeKB}KB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {last && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold font-mono text-slate-200">${last.c.toFixed(2)}</span>
              <span className={`text-xs font-medium ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          )}
          <button
            onClick={() => load(ticker, true)}
            title="清除快取並重新下載"
            className="text-slate-600 hover:text-blue-400 transition-colors p-0.5"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* Header row 2: period buttons + MA legend */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex flex-wrap gap-0.5">
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
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {[
            { key: 'MA5',  color: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400' },
            { key: 'MA20', color: 'bg-blue-400',   border: 'border-blue-400',   text: 'text-blue-400'   },
            { key: 'MA60', color: 'bg-orange-400', border: 'border-orange-400', text: 'text-orange-400' },
          ].map(({ key, color, border, text }) => (
            <button
              key={key}
              onClick={() => toggleMA(key)}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                visibleMAs[key]
                  ? `${border} ${text} bg-transparent`
                  : 'border-slate-700 text-slate-600 bg-transparent'
              }`}
            >
              <span className={`w-3 h-0.5 inline-block rounded-full ${visibleMAs[key] ? color : 'bg-slate-700'}`} />
              {key}
            </button>
          ))}
        </div>
      </div>

      <Chart options={options} series={series} type="candlestick" height={300} />

      <div className="flex gap-4 mt-1 text-[10px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />漲（紅）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />跌（綠）
        </span>
        <span className="ml-auto">可滾輪縮放 · 拖曳平移</span>
      </div>
    </div>
  );
};

export default CandlestickChart;
