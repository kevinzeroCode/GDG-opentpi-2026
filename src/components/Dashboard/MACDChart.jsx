import React from 'react';

const MACDChart = ({ macd, signal, histogram }) => {
  const macdVal = typeof macd === 'number' ? macd : 0;
  const signalVal = typeof signal === 'number' ? signal : 0;
  const histVal = typeof histogram === 'number' ? histogram : 0;
  const isPositive = histVal >= 0;

  const getCrossSignal = () => {
    if (macdVal > signalVal) return { text: '黃金交叉（多頭）', color: 'text-green-400' };
    return { text: '死亡交叉（空頭）', color: 'text-red-400' };
  };

  const getMomentum = () => {
    if (histVal > 0) return { text: '多頭動能', color: 'text-green-400', bg: 'bg-green-500' };
    return { text: '空頭動能', color: 'text-red-400', bg: 'bg-red-500' };
  };

  const cross = getCrossSignal();
  const momentum = getMomentum();

  // Normalize histogram bar width (cap at reasonable range)
  const maxRange = Math.max(Math.abs(histVal), 1);
  const barPercent = Math.min(Math.abs(histVal) / maxRange * 50, 50);

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-4">
        <span className="text-slate-400 text-sm font-medium">MACD 指標</span>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${momentum.color} ${
          isPositive ? 'bg-green-500/10' : 'bg-red-500/10'
        }`}>
          {momentum.text}
        </span>
      </div>

      {/* MACD & Signal values */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/50 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase mb-1">MACD</div>
          <div className={`text-lg font-mono font-bold ${macdVal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {macdVal.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-900/50 rounded-xl p-3">
          <div className="text-[10px] text-slate-500 uppercase mb-1">Signal</div>
          <div className={`text-lg font-mono font-bold ${signalVal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {signalVal.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Histogram bar */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-400">Histogram</span>
          <span className={`text-sm font-mono font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {histVal.toFixed(2)}
          </span>
        </div>
        <div className="relative h-6 bg-slate-700 rounded-lg overflow-hidden">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 h-full w-px bg-slate-500" />
          {/* Bar */}
          <div
            className={`absolute top-1 bottom-1 rounded transition-all duration-500 ${momentum.bg}`}
            style={{
              left: isPositive ? '50%' : `${50 - barPercent}%`,
              width: `${barPercent}%`,
              opacity: 0.8,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>空頭</span>
          <span>0</span>
          <span>多頭</span>
        </div>
      </div>

      {/* Cross signal */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-700">
        <span className="text-xs text-slate-500">交叉狀態</span>
        <span className={`text-xs font-bold ${cross.color}`}>{cross.text}</span>
      </div>
    </div>
  );
};

export default MACDChart;
