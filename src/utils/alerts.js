const STORAGE_KEY = 'quant_alerts';

// Alert shape: { id, ticker, indicator, operator, value, enabled }
// indicator: 'rsi' | 'k' | 'd' | 'macd' | 'price'
// operator: '>' | '<'

export const getAlerts = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

export const saveAlert = (alert) => {
  const alerts = getAlerts();
  alerts.push({ ...alert, id: Date.now(), enabled: true });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
};

export const removeAlert = (id) => {
  const alerts = getAlerts().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
};

export const checkAlerts = (ticker, metrics) => {
  if (!ticker || !metrics) return [];
  const alerts = getAlerts().filter((a) => a.enabled && a.ticker === ticker);
  const triggered = [];

  for (const alert of alerts) {
    const val = metrics[alert.indicator];
    if (val == null) continue;

    const hit = alert.operator === '>'
      ? val > alert.value
      : val < alert.value;

    if (hit) {
      triggered.push({
        ...alert,
        currentValue: val,
        message: `${ticker} ${alert.indicator.toUpperCase()} = ${val.toFixed(2)} ${alert.operator} ${alert.value}`,
      });
    }
  }

  return triggered;
};
