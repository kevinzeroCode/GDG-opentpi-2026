import { getTickerShort } from './tickerNames';

/**
 * Generate beginner-friendly financial expert commentary from parsed metrics.
 */
export const generateCommentary = (ticker, metrics) => {
  if (!metrics) return null;

  const name = getTickerShort(ticker);
  const lines = [];

  // --- Header ---
  lines.push(`【${name} (${ticker}) 技術面分析】\n`);

  // --- Price + MA5 ---
  if (metrics.price) {
    lines.push(`目前股價為 ${metrics.price.toFixed(2)} 元。`);
    if (metrics.ma5) {
      const diff = metrics.price - metrics.ma5;
      if (diff > 0) {
        lines.push(`股價高於 5 日均線（${metrics.ma5.toFixed(2)}），代表近期買氣較強，短期走勢偏多。`);
      } else if (diff < 0) {
        lines.push(`股價低於 5 日均線（${metrics.ma5.toFixed(2)}），代表近期賣壓較重，短期走勢偏弱。`);
      } else {
        lines.push(`股價貼近 5 日均線（${metrics.ma5.toFixed(2)}），目前處於多空拉鋸狀態。`);
      }
    }
    lines.push('');
  }

  // --- RSI ---
  if (metrics.rsi != null) {
    const rsi = metrics.rsi;
    lines.push(`RSI 指標為 ${rsi}，`);
    if (rsi > 80) {
      lines.push(`已進入嚴重超買區域。這表示短期內上漲速度過快，股價隨時可能出現拉回修正，建議謹慎追高。`);
    } else if (rsi > 70) {
      lines.push(`進入超買區域（>70）。雖然代表市場看多氣氛濃厚，但也暗示股價可能接近短期高點，需留意回檔風險。`);
    } else if (rsi > 50) {
      lines.push(`位於中性偏多區間，代表目前買盤力道穩健，市場情緒正面，短期仍有上漲動能。`);
    } else if (rsi > 30) {
      lines.push(`位於中性偏空區間，代表賣壓略大於買氣，短期走勢較為疲弱，建議觀望。`);
    } else if (rsi > 20) {
      lines.push(`已進入超賣區域（<30）。股價可能被過度拋售，對於看好基本面的投資人而言，或許是留意反彈的機會。`);
    } else {
      lines.push(`處於嚴重超賣狀態，股價極度低迷。若公司基本面無重大惡化，技術面上有超跌反彈的可能。`);
    }
    lines.push('');
  }

  // --- KD ---
  if (metrics.k != null && metrics.d != null) {
    const k = metrics.k;
    const d = metrics.d;
    lines.push(`KD 指標：K 值 ${k.toFixed(1)}、D 值 ${d.toFixed(1)}。`);
    if (k > 80 && d > 80) {
      lines.push(`兩者皆在高檔區（>80），代表短期漲幅已大，需留意「死亡交叉」（K 跌破 D）出現的反轉訊號。`);
    } else if (k < 20 && d < 20) {
      lines.push(`兩者皆在低檔區（<20），代表股價已被超賣。若 K 線由下往上穿越 D 線形成「黃金交叉」，可能出現反彈。`);
    } else if (k > d) {
      lines.push(`K 值位於 D 值之上，顯示短期上漲動能仍在延續，多方仍佔優勢。`);
    } else {
      lines.push(`K 值跌至 D 值之下，顯示短期動能轉弱，賣壓逐漸增加，建議留意趨勢變化。`);
    }
    lines.push('');
  }

  // --- MACD ---
  if (metrics.macd != null && metrics.signal != null) {
    const macd = metrics.macd;
    const signal = metrics.signal;
    const hist = metrics.histogram ?? (macd - signal);

    lines.push(`MACD 分析：MACD 線 ${macd.toFixed(2)}、信號線 ${signal.toFixed(2)}、柱狀體 ${hist.toFixed(2)}。`);
    if (macd > signal && hist > 0) {
      lines.push(`MACD 在信號線之上且柱狀體為正值，屬於多頭格局。`);
      if (hist > 1) {
        lines.push(`柱狀體數值較大，代表上漲動能強勁。`);
      }
    } else if (macd < signal && hist < 0) {
      lines.push(`MACD 在信號線之下且柱狀體為負值，屬於空頭格局，短期仍偏弱勢。`);
    } else {
      lines.push(`MACD 與信號線接近，可能即將出現交叉訊號，建議密切關注方向變化。`);
    }
    lines.push('');
  }

  // --- Trend summary ---
  lines.push('--- 綜合觀點 ---');
  if (metrics.trend === '多頭') {
    lines.push(`目前整體趨勢判定為「多頭」，短期均線排列向上。但技術指標僅反映過去走勢，不代表未來表現，仍需搭配基本面與市場消息綜合判斷。`);
  } else if (metrics.trend === '空頭') {
    lines.push(`目前整體趨勢判定為「空頭」，短期均線排列向下。建議保守操作，等待趨勢明確反轉再進場。`);
  } else {
    lines.push(`目前趨勢尚不明朗，建議觀望等待更明確的方向訊號。`);
  }

  lines.push('\n以上為純技術面分析，僅供參考，不構成投資建議。');

  return lines.join('\n');
};
