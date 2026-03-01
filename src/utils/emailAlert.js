const EMAIL_KEY = 'alert_email';
const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';

export const getAlertEmail = () => localStorage.getItem(EMAIL_KEY) || '';
export const setAlertEmail = (email) => localStorage.setItem(EMAIL_KEY, email);

const buildHtml = (ticker, message, time) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="font-size:11px;color:#93c5fd;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">QUANT AI ASSISTANT</div>
                  <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">&#128276; 價格警報觸發</div>
                </td>
                <td align="right">
                  <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:10px 18px;display:inline-block;">
                    <div style="font-size:11px;color:#bfdbfe;margin-bottom:2px;">股票代號</div>
                    <div style="font-size:28px;font-weight:900;color:#ffffff;font-family:monospace;">${ticker}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Alert Box -->
        <tr>
          <td style="padding:28px 32px 0;">
            <div style="background:#0f172a;border:1px solid #ef4444;border-left:4px solid #ef4444;border-radius:10px;padding:20px 24px;">
              <div style="font-size:11px;color:#f87171;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">&#9888;&#65039; 觸發條件</div>
              <div style="font-size:22px;font-weight:700;color:#fbbf24;font-family:monospace;letter-spacing:0.5px;">${message}</div>
            </div>
          </td>
        </tr>

        <!-- Time Row -->
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:16px 20px;border-right:1px solid #1e293b;">
                  <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">警報時間</div>
                  <div style="font-size:14px;font-weight:600;color:#e2e8f0;">${time}</div>
                </td>
                <td style="padding:16px 20px;">
                  <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">狀態</div>
                  <div style="font-size:14px;font-weight:700;color:#22c55e;">&#9679; 已觸發（僅發送一次）</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Info -->
        <tr>
          <td style="padding:0 32px 28px;">
            <div style="background:#1e3a5f;border-radius:10px;padding:14px 20px;font-size:13px;color:#7dd3fc;line-height:1.7;">
              &#128270; 此警報由 <strong>Quant AI Assistant</strong> 自動監測發送。<br>
              條件達成後不會重複通知，如需再次監測請至系統重設警報。
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;padding:16px 32px;border-top:1px solid #1e293b;text-align:center;">
            <span style="font-size:11px;color:#475569;">Quant AI Assistant &nbsp;&#183;&nbsp; Powered by TWSE Live Data</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const sendAlertEmail = async (ticker, message) => {
  const email = getAlertEmail();
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!email || !serviceId || !templateId || !publicKey) return;

  const time = new Date().toLocaleString('zh-TW');

  try {
    await fetch(EMAILJS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: email,
          name: 'Quant AI Assistant',
          email: email,
          ticker,
          message,
          time,
        },
      }),
    });
  } catch (e) {
    console.warn('Email 發送失敗:', e.message);
  }
};
