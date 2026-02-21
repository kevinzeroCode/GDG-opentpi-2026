import React from 'react';
import Chart from 'react-apexcharts';

const GaugeChart = ({ value }) => {
  const options = {
    chart: { type: 'radialBar', sparkline: { enabled: true } },
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
            color: '#f8fafc',
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
        gradientToColors: [value > 70 ? '#ef4444' : '#3b82f6'],
        stops: [0, 100]
      }
    },
    stroke: { lineCap: 'round' },
    labels: ['RSI'],
  };

  return <Chart options={options} series={[value]} type="radialBar" height={280} />;
};

export default GaugeChart;