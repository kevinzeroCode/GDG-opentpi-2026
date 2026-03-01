import React from 'react';

const KDChart = ({ k, d }) => {
  const kVal = typeof k === 'number' ? k : 0;
  const dVal = typeof d === 'number' ? d : 0;

  const getStatus = (val) => {
    if (val > 80) return { text: '超買', color: 'text-red-400' };
    if (val < 20) return { text: '超賣', color: 'text-green-400' };
    return { text: '中性', color: 'text-slate-300' };
  };

  const getCrossSignal = () => {
    if (kVal > dVal && kVal < 30) return { text: '黃金交叉', color: 'text-red-400' };
    if (kVal < dVal && kVal > 70) return { text: '死亡交叉', color: 'text-green-400' };
    if (kVal > dVal) return { text: 'K > D 多方', color: 'text-red-400' };
    return { text: 'K < D 空方', color: 'text-green-400' };
  };

  const status = getStatus(kVal);
  const cross = getCrossSignal();

  const renderBar = (label, value, color) => (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span className={`text-sm font-mono font-bold ${color}`}>{value.toFixed(2)}</span>
      </div>
      <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden">
        {/* Overbought/Oversold zone markers */}
        <div className="absolute left-0 top-0 h-full bg-green-500/10" style={{ width: '20%' }} />
        <div className="absolute right-0 top-0 h-full bg-red-500/10" style={{ width: '20%' }} />
        {/* Zone boundary lines */}
        <div className="absolute top-0 h-full w-px bg-green-500/40" style={{ left: '20%' }} />
        <div className="absolute top-0 h-full w-px bg-red-500/40" style={{ left: '80%' }} />
        {/* Value bar */}
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(Math.max(value, 0), 100)}%`,
            background: `linear-gradient(90deg, ${color === 'text-blue-400' ? '#3b82f6' : '#f59e0b'}, ${value > 80 ? '#ef4444' : value < 20 ? '#22c55e' : color === 'text-blue-400' ? '#60a5fa' : '#fbbf24'})`,
          }}
        />
      </div>
    </div>
  );

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <span className="text-slate-400 text-sm font-medium">KD 隨機指標</span>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${status.color} ${
          status.text === '超買' ? 'bg-red-500/10' : status.text === '超賣' ? 'bg-green-500/10' : 'bg-slate-700'
        }`}>
          {status.text}
        </span>
      </div>

      {renderBar('K 值', kVal, 'text-blue-400')}
      {renderBar('D 值', dVal, 'text-amber-400')}

      {/* Zone labels */}
      <div className="flex justify-between text-[10px] text-slate-600 mt-1 mb-3">
        <span>0 超賣</span>
        <span>50</span>
        <span>超買 100</span>
      </div>

      {/* Cross signal */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-700">
        <span className="text-xs text-slate-500">交叉訊號</span>
        <span className={`text-xs font-bold ${cross.color}`}>{cross.text}</span>
      </div>
    </div>
  );
};

export default KDChart;
