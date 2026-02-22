import React from 'react';
import Chart from 'react-apexcharts';
import { getHistory } from '../../utils/history';

const PriceChart = ({ ticker }) => {
  const history = getHistory(ticker);

  if (!ticker || history.length < 2) return null;

  const priceSeries = [
    { name: '價格', data: history.map((r) => [r.timestamp, r.metrics.price]) },
    { name: 'MA5', data: history.map((r) => [r.timestamp, r.metrics.ma5]) },
  ];

  const options = {
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
    stroke: { curve: 'smooth', width: [2, 1.5], dashArray: [0, 4] },
    markers: { size: 3, hover: { size: 5 } },
    colors: ['#3b82f6', '#f59e0b'],
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
      labels: {
        style: { colors: '#64748b', fontSize: '10px' },
        formatter: (val) => val?.toFixed(1),
      },
    },
    tooltip: {
      theme: 'dark',
      x: { format: 'MM/dd HH:mm' },
      y: { formatter: (val) => `$${val?.toFixed(2)}` },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: { colors: '#94a3b8' },
      fontSize: '11px',
    },
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
      <div className="text-xs text-slate-500 uppercase mb-2 font-medium">價格走勢</div>
      <Chart options={options} series={priceSeries} type="line" height={160} />
    </div>
  );
};

export default PriceChart;
