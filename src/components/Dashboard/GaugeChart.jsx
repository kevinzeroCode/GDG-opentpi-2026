import React from 'react';
import Chart from 'react-apexcharts';

const GaugeChart = ({ value }) => {
  // 💡 確保傳入的是數字，且給予預設值防止 0.00 鎖死
  const chartValue = typeof value === 'number' ? value : parseFloat(value) || 0;

  const options = {
    chart: { 
      type: 'radialBar', 
      sparkline: { enabled: true },
      // 💡 增加動畫效果
      animations: { enabled: true, easing: 'easeinout', speed: 800 }
    },
    plotOptions: {
      radialBar: {
        startAngle: -110,
        endAngle: 110,
        hollow: { size: '65%' },
        track: { background: "#1e293b", strokeWidth: '100%' },
        dataLabels: {
          name: { show: false },
          value: {
            offsetY: 10,
            fontSize: '32px',
            fontWeight: '700',
            color: '#f8fafc',
            // 💡 確保格式化小數點
            formatter: (val) => val.toFixed(2)
          }
        }
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'horizontal',
        gradientToColors: [chartValue > 70 ? '#ef4444' : chartValue < 30 ? '#22c55e' : '#3b82f6'],
        stops: [0, 100]
      }
    },
    stroke: { lineCap: 'round' },
    labels: ['RSI'],
  };

  // 💡 給 Chart 一個動態 key，當數值改變時強制組件重新渲染
  return (
    <div className="w-full">
      <Chart 
        key={`rsi-chart-${chartValue}`} 
        options={options} 
        series={[chartValue]} 
        type="radialBar" 
        height={280} 
      />
    </div>
  );
};

export default GaugeChart;