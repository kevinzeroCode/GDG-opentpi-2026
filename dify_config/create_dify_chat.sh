#!/bin/bash
# =====================================================
# 自動建立 Dify Chat App 並寫入 data-platform .env
# 用法：bash create_dify_chat.sh
# =====================================================

DIFY_URL="http://localhost:80"
DIFY_EMAIL="kevin456hope@gmail.com"
ENV_FILE="$(dirname "$0")/data-platform/.env"

echo "=== Dify Chat App 自動建立腳本 ==="
echo ""
read -s -p "請輸入 Dify 登入密碼（${DIFY_EMAIL}）: " DIFY_PASSWORD
echo ""

# ── Step 1: 登入取得 access token ─────────────────────
echo "[1/4] 登入 Dify Console..."
LOGIN_RESP=$(curl -s -X POST "${DIFY_URL}/console/api/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${DIFY_EMAIL}\",\"password\":\"${DIFY_PASSWORD}\",\"language\":\"zh-Hans\",\"remember_me\":true}")

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = d.get('data', {}).get('access_token') or d.get('access_token', '')
print(t)
" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ 登入失敗！請確認密碼。"
  echo "回應: $LOGIN_RESP" | head -c 200
  exit 1
fi
echo "   ✅ 登入成功"

# ── Step 2: 建立 Chat App ──────────────────────────────
echo "[2/4] 建立 Chat App..."
CREATE_RESP=$(curl -s -X POST "${DIFY_URL}/console/api/apps" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{
    "name": "股票分析助手 Chat",
    "description": "QuantDashboard AI 對話式股票分析",
    "mode": "chat",
    "icon": "🤖",
    "icon_background": "#1C64F2"
  }')

APP_ID=$(echo "$CREATE_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('id', ''))
" 2>/dev/null)

if [ -z "$APP_ID" ]; then
  echo "❌ 建立 App 失敗！"
  echo "回應: $CREATE_RESP" | head -c 300
  exit 1
fi
echo "   ✅ App 建立成功（ID: ${APP_ID}）"

# ── Step 3: 取得 API Key ───────────────────────────────
echo "[3/4] 取得 API Key..."
KEY_RESP=$(curl -s -X POST "${DIFY_URL}/console/api/apps/${APP_ID}/api-keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{}')

API_KEY=$(echo "$KEY_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
# 可能是 list 或 dict
if isinstance(d, list):
    print(d[0].get('token', '') if d else '')
elif isinstance(d, dict):
    print(d.get('token', '') or d.get('api_key', ''))
" 2>/dev/null)

if [ -z "$API_KEY" ]; then
  echo "⚠️  無法自動取得 API Key，嘗試列出現有 keys..."
  KEY_LIST=$(curl -s "${DIFY_URL}/console/api/apps/${APP_ID}/api-keys" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")
  API_KEY=$(echo "$KEY_LIST" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
if isinstance(data, list) and data:
    print(data[0].get('token', ''))
" 2>/dev/null)
fi

if [ -z "$API_KEY" ]; then
  echo "❌ 無法取得 API Key"
  echo "回應: $KEY_RESP" | head -c 300
  exit 1
fi
echo "   ✅ API Key: ${API_KEY}"

# ── Step 4: 寫入 .env ─────────────────────────────────
echo "[4/4] 寫入 data-platform/.env..."

if grep -q "DIFY_CHAT_API_KEY" "$ENV_FILE"; then
  # 更新既有行
  sed -i "s|^DIFY_CHAT_API_KEY=.*|DIFY_CHAT_API_KEY=${API_KEY}|" "$ENV_FILE"
else
  # 新增一行
  echo "DIFY_CHAT_API_KEY=${API_KEY}" >> "$ENV_FILE"
fi

echo "   ✅ 已寫入 ${ENV_FILE}"

# ── 完成 ──────────────────────────────────────────────
echo ""
echo "======================================"
echo "✅ 完成！接下來執行："
echo ""
echo "  docker compose -f \"$(dirname "$0")/data-platform/docker-compose.yml\" restart data-platform"
echo ""
echo "重啟後 Dify Chat 模式即啟用（支援多輪對話 conversation_id）"
echo "======================================"
