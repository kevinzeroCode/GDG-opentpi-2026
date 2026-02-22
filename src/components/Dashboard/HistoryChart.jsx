import React, { useState } from 'react';
import Chart from 'react-apexcharts';
import { getHistory, clearHistory, getHistoryInRange, calcAnnualizedReturn, getAllTickers } from '../../utils/history';
import { Clock, Trash2, TrendingUp, TrendingDown, GitCompareArrows, X } from 'lucide-react';
import { getTickerShort } from '../../utils/tickerNames';

const commonChartOptions = {
  chart: {
    background: 'transparent',
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, easing: 'easeinout', speed: 600 },
  },
  theme: { mode: 'dark' },
  grid: {
    borderColor: '#334155',
    strokeDashArray: 3,
    xaxis: { lines: { show: false } },
  },
  stroke: { curve: 'smooth', width: 2 },
  markers: { size: 3, hover: { size: 5 } },
  xaxis: {
    type: 'datetime',
    labels: {
      style: { colors: '#64748b', fontSize: '10px' },
      datetimeFormatter: { hour: 'HH:mm', day: 'MM/dd' },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: { style: { colors: '#64748b', fontSize: '10px' } },
  },
  tooltip: {
    theme: 'dark',
    x: { format: 'MM/dd HH:mm' },
  },
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    labels: { colors: '#94a3b8' },
    fontSize: '11px',
  },
};

// Use local time, not UTC
const toDateStr = (ts) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Parse "YYYY-MM-DD" as local midnight (not UTC)
const parseLocalDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

const presets = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1Y', days: 365 },
  { label: '全部', days: null },
];

const COMPARE_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7'];

const HistoryChart = ({ ticker: initialTicker }) => {
  const [, forceUpdate] = useState(0);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [compareTickers, setCompareTickers] = useState([]);
  const ticker = selectedTicker || initialTicker;
  const savedTickers = getAllTickers();
  const allHistory = getHistory(ticker);

  const toggleCompare = (t) => {
    setCompareTickers((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length < 4 ? [...prev, t] : prev
    );
  };

  const defaultEnd = toDateStr(Date.now());
  const [activePreset, setActivePreset] = useState('1Y');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Compute effective start from preset or manual input
  const getPresetStart = (label) => {
    const p = presets.find((x) => x.label === label);
    if (!p || p.days === null) {
      return allHistory.length > 0 ? toDateStr(allHistory[0].timestamp) : defaultEnd;
    }
    const d = new Date();
    d.setDate(d.getDate() - p.days);
    return toDateStr(d.getTime());
  };

  const effectiveStart = startDate || getPresetStart(activePreset);
  const effectiveEnd = endDate || defaultEnd;

  // Filtered history — no useMemo, always fresh
  const startTs = parseLocalDate(effectiveStart);
  const endTs = parseLocalDate(effectiveEnd) + 86400000 - 1; // end of day
  const history = (ticker && allHistory.length > 0)
    ? getHistoryInRange(ticker, startTs, endTs)
    : [];

  // Annualized return
  const annualReturn = calcAnnualizedReturn(history);

  const handlePreset = (label) => {
    setActivePreset(label);
    setStartDate('');
    setEndDate('');
  };

  const handleClear = () => {
    clearHistory(ticker);
    setStartDate('');
    setEndDate('');
    setActivePreset('1Y');
    forceUpdate((n) => n + 1);
  };

  const handleDeleteTicker = (t) => {
    clearHistory(t);
    if (t === ticker) {
      const remaining = savedTickers.filter((x) => x !== t);
      setSelectedTicker(remaining.length > 0 ? remaining[0] : '');
    }
    setCompareTickers((prev) => prev.filter((x) => x !== t));
    forceUpdate((n) => n + 1);
  };

  if (!ticker) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
        <Clock size={48} className="mb-4 opacity-20" />
        <p className="text-sm">尚無股票代碼<br />請先查詢一檔股票</p>
      </div>
    );
  }

  if (allHistory.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[300px]">
        <Clock size={48} className="mb-4 opacity-20" />
        <p className="text-sm">
          {getTickerShort(ticker)} 尚無歷史資料<br />
          查詢後會自動記錄
        </p>
      </div>
    );
  }

  // RSI series
  const rsiSeries = [
    { name: 'RSI', data: history.map((r) => [r.timestamp, r.metrics.rsi]) },
  ];

  // KD series
  const kdSeries = [
    { name: 'K', data: history.map((r) => [r.timestamp, r.metrics.k ?? 0]) },
    { name: 'D', data: history.map((r) => [r.timestamp, r.metrics.d ?? 0]) },
  ];

  // MACD series (line) + Histogram (column)
  const macdLineSeries = [
    { name: 'MACD', type: 'line', data: history.map((r) => [r.timestamp, r.metrics.macd ?? 0]) },
    { name: 'Signal', type: 'line', data: history.map((r) => [r.timestamp, r.metrics.signal ?? 0]) },
    { name: 'Histogram', type: 'column', data: history.map((r) => [r.timestamp, r.metrics.histogram ?? 0]) },
  ];

  const rsiOptions = {
    ...commonChartOptions,
    chart: { ...commonChartOptions.chart, id: 'rsi-history' },
    colors: ['#3b82f6'],
    yaxis: {
      ...commonChartOptions.yaxis,
      min: 0,
      max: 100,
    },
    annotations: {
      yaxis: [
        { y: 70, borderColor: '#ef4444', strokeDashArray: 4, label: { text: '超買 70', style: { color: '#ef4444', background: 'transparent', fontSize: '10px' } } },
        { y: 30, borderColor: '#22c55e', strokeDashArray: 4, label: { text: '超賣 30', style: { color: '#22c55e', background: 'transparent', fontSize: '10px' } } },
      ],
    },
  };

  const kdOptions = {
    ...commonChartOptions,
    chart: { ...commonChartOptions.chart, id: 'kd-history' },
    colors: ['#3b82f6', '#f59e0b'],
    yaxis: {
      ...commonChartOptions.yaxis,
      min: 0,
      max: 100,
    },
    annotations: {
      yaxis: [
        { y: 80, borderColor: '#ef4444', strokeDashArray: 4, label: { text: '超買 80', style: { color: '#ef4444', background: 'transparent', fontSize: '10px' } } },
        { y: 20, borderColor: '#22c55e', strokeDashArray: 4, label: { text: '超賣 20', style: { color: '#22c55e', background: 'transparent', fontSize: '10px' } } },
      ],
    },
  };

  const macdOptions = {
    ...commonChartOptions,
    chart: { ...commonChartOptions.chart, id: 'macd-history' },
    colors: ['#3b82f6', '#f59e0b', '#64748b'],
    stroke: { curve: 'smooth', width: [2, 2, 0] },
    plotOptions: {
      bar: { columnWidth: '40%' },
    },
    yaxis: {
      ...commonChartOptions.yaxis,
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        formatter: (val) => val?.toFixed(2),
      },
    },
    annotations: {
      yaxis: [
        { y: 0, borderColor: '#475569', strokeDashArray: 0 },
      ],
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ticker Tags + Compare Toggle */}
      {savedTickers.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {savedTickers.map((t) => (
            <span key={t} className={`inline-flex items-center gap-1 rounded-lg text-xs transition-colors ${
              compareMode
                ? compareTickers.includes(t) ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                : t === ticker ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              <button
                onClick={() => compareMode ? toggleCompare(t) : (() => { setSelectedTicker(t); setStartDate(''); setEndDate(''); setActivePreset('1Y'); })()}
                className="px-2.5 py-1 hover:opacity-80"
              >
                {getTickerShort(t)}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteTicker(t); }}
                className="pr-1.5 py-1 opacity-50 hover:opacity-100 hover:text-red-400 transition-colors"
                title="刪除歷史"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={() => { setCompareMode(!compareMode); setCompareTickers([]); }}
            className={`px-2 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 ${
              compareMode ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
            }`}
          >
            <GitCompareArrows size={12} /> 比較
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <span className="text-slate-400 text-sm font-medium">
          {getTickerShort(ticker)} 歷史趨勢 ({history.length} 筆)
        </span>
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} /> 清除
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.label)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              activePreset === p.label && !startDate
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-500">開始</label>
        <input
          type="date"
          value={effectiveStart}
          onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        />
        <label className="text-xs text-slate-500">結束</label>
        <input
          type="date"
          value={effectiveEnd}
          onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Annualized Return Card */}
      {annualReturn !== null && (
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
            annualReturn >= 0
              ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
              : 'bg-red-900/30 border-red-700/50 text-red-400'
          }`}
        >
          {annualReturn >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="text-sm font-medium">
            年化報酬率：{annualReturn >= 0 ? '+' : ''}{annualReturn.toFixed(2)}%
          </span>
        </div>
      )}

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[200px]">
          <p className="text-sm">篩選範圍內無資料</p>
        </div>
      ) : (
        <>
          {/* RSI History */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <div className="text-xs text-slate-500 uppercase mb-2 font-medium">RSI 歷史</div>
            <Chart options={rsiOptions} series={rsiSeries} type="line" height={180} />
          </div>

          {/* KD History */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <div className="text-xs text-slate-500 uppercase mb-2 font-medium">KD 歷史</div>
            <Chart options={kdOptions} series={kdSeries} type="line" height={180} />
          </div>

          {/* MACD History */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <div className="text-xs text-slate-500 uppercase mb-2 font-medium">MACD 歷史</div>
            <Chart options={macdOptions} series={macdLineSeries} type="line" height={200} />
          </div>
        </>
      )}

      {/* Compare Charts */}
      {compareMode && compareTickers.length >= 2 && (() => {
        const compareRsi = compareTickers.map((t, i) => ({
          name: `${getTickerShort(t)} RSI`,
          data: getHistoryInRange(t, startTs, endTs).map((r) => [r.timestamp, r.metrics.rsi]),
        }));
        const compareK = compareTickers.map((t, i) => ({
          name: `${getTickerShort(t)} K`,
          data: getHistoryInRange(t, startTs, endTs).map((r) => [r.timestamp, r.metrics.k ?? 0]),
        }));
        return (
          <>
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-2xl p-4">
              <div className="text-xs text-purple-400 uppercase mb-2 font-medium">RSI 比較</div>
              <Chart
                options={{ ...commonChartOptions, chart: { ...commonChartOptions.chart, id: 'rsi-compare' }, colors: COMPARE_COLORS, yaxis: { ...commonChartOptions.yaxis, min: 0, max: 100 } }}
                series={compareRsi}
                type="line"
                height={180}
              />
            </div>
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-2xl p-4">
              <div className="text-xs text-purple-400 uppercase mb-2 font-medium">K 值比較</div>
              <Chart
                options={{ ...commonChartOptions, chart: { ...commonChartOptions.chart, id: 'k-compare' }, colors: COMPARE_COLORS, yaxis: { ...commonChartOptions.yaxis, min: 0, max: 100 } }}
                series={compareK}
                type="line"
                height={180}
              />
            </div>
          </>
        );
      })()}
    </div>
  );
};

export default HistoryChart;
