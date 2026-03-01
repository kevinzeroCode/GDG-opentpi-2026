const STORAGE_KEY = 'quant_alerts';

// Alert shape: { id, ticker, indicator, operator, value, enabled, firedAt }

export const getAlerts = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

const _save = (alerts) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
};

export const saveAlert = (alert) => {
  const alerts = getAlerts();
  alerts.push({ ...alert, id: Date.now(), enabled: true, firedAt: null });
  _save(alerts);
};

export const removeAlert = (id) => {
  _save(getAlerts().filter((a) => a.id !== id));
};

// 標記已觸發（之後不再重複發送）
export const markAlertFired = (id) => {
  const alerts = getAlerts().map((a) =>
    a.id === id ? { ...a, firedAt: Date.now() } : a
  );
  _save(alerts);
};

// 重設警報（允許再次觸發）
export const resetAlert = (id) => {
  const alerts = getAlerts().map((a) =>
    a.id === id ? { ...a, firedAt: null } : a
  );
  _save(alerts);
};

export const checkAlerts = (ticker, metrics) => {
  if (!ticker || !metrics) return [];
  // 只檢查尚未觸發過的警報
  const alerts = getAlerts().filter((a) => a.enabled && a.ticker === ticker && !a.firedAt);
  const triggered = [];

  for (const alert of alerts) {
    const val = metrics[alert.indicator];
    if (val == null) continue;

    const hit =
      alert.operator === '>'  ? val > alert.value  :
      alert.operator === '<'  ? val < alert.value  :
      alert.operator === '>=' ? val >= alert.value :
      alert.operator === '<=' ? val <= alert.value :
      val === alert.value;
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
