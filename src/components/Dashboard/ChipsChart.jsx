import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import { Loader2, Users } from 'lucide-react';
import { fetchInstitutional, processInstitutional, calcCumulative } from '../../utils/chipsData';

const fmtNet = (v) => {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}萬`;
  if (abs >= 1000)  return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${v >= 0 ? '+' : ''}${v.toLocaleString()}`;
};

const StatCard = ({ label, value }) => {
  const color = value > 0 ? 'text-red-400' : value < 0 ? 'text-green-400' : 'text-slate-400';
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-2xl">
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${color}`}>
        {fmtNet(value)} 張
      </div>
    </div>
  );
};

export default function ChipsChart({ ticker }) {
  const [processed, setProcessed] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastDate, setLastDate]   = useState(null);

  useEffect(() => {
    if (!ticker) { setProcessed(null); setError(null); return; }
    setLoading(true);
    setError(null);
    fetchInstitutional(ticker, 40)
      .then((raw) => {
        const data = processInstitutional(raw);
        setProcessed(data);
        if (data.length > 0) setLastDate(data[data.length - 1].date);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (!ticker) {
    return (
      <div className="flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl p-10 text-center min-h-[200px]">
        <p className="text-sm">請先查詢股票以顯示籌碼資料</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-500 gap-2">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">載入籌碼資料中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm p-4 bg-red-900/20 border border-red-700/50 rounded-2xl">
        {error}
      </div>
    );
  }

  if (!processed?.length) return null;

  const stats = [
    { label: '外資 近5日',  value: calcCumulative(processed, 'foreign', 5)  },
    { label: '外資 近10日', value: calcCumulative(processed, 'foreign', 10) },
    { label: '投信 近5日',  value: calcCumulative(processed, 'trust',   5)  },
    { label: '投信 近10日', value: calcCumulative(processed, 'trust',   10) },
  ];

  const recent       = processed.slice(-20);
  const dates        = recent.map((d) => d.date.slice(5).replace('-', '/'));
  const foreignSeries = recent.map((d) => d.foreign);
  const trustSeries   = recent.map((d) => d.trust);

  const chartOptions = {
    chart: {
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: false },
    },
    theme: { mode: 'dark' },
    plotOptions: {
      bar: {
        columnWidth: '65%',
        borderRadius: 2,
      },
    },
    xaxis: {
      categories: dates,
      labels: {
        style: { colors: '#64748b', fontSize: '9px' },
        rotate: -45,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        formatter: (v) => {
          const abs = Math.abs(v);
          if (abs >= 10000) return `${(v / 10000).toFixed(1)}萬`;
          if (abs >= 1000)  return `${(v / 1000).toFixed(0)}K`;
          return String(v);
        },
      },
    },
    colors: ['#f59e0b', '#60a5fa'],
    legend: {
      labels: { colors: '#94a3b8' },
      fontSize: '11px',
      markers: { radius: 3 },
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: (v) => `${v >= 0 ? '+' : ''}${v.toLocaleString()} 張`,
      },
    },
    grid: { borderColor: '#1e293b', strokeDashArray: 3 },
    dataLabels: { enabled: false },
  };

  const series = [
    { name: '外資', data: foreignSeries },
    { name: '投信', data: trustSeries  },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400 uppercase font-medium">
          <Users size={14} className="text-amber-400" />
          法人籌碼
        </div>
        {lastDate && (
          <span className="text-[10px] text-slate-600">最後資料日：{lastDate}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
        <div className="text-[10px] text-slate-500 uppercase mb-3 font-medium">
          外資 / 投信 每日淨買賣超（近20交易日，張）
        </div>
        <Chart options={chartOptions} series={series} type="bar" height={220} />
        <div className="flex gap-4 mt-2 text-[10px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-sm bg-amber-400 inline-block" /> 外資
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-sm bg-blue-400 inline-block" /> 投信
          </span>
          <span className="ml-auto">柱體向上 = 買超，向下 = 賣超</span>
        </div>
      </div>
    </div>
  );
}
