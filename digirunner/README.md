# DigiRunner API Gateway 設定

本專案使用 [DigiRunner Open Source](https://github.com/TPIsoftwareOSPO/digiRunner-Open-Source) 作為 API Gateway，統一管理對外 API 呼叫。

## 架構

```
Browser → DigiRunner (:31080) → Finmind API (台股K線)
                               → Dify Workflow (AI分析)
```

## 快速啟動

### 1. 啟動 DigiRunner

```bash
docker-compose up -d digirunner
```

等待約 40 秒後，開啟管理介面：
- URL：http://localhost:31080/dgrv4/login
- 帳號：`manager`
- 密碼：`manager123`

### 2. 匯入 API 路由設定

1. 登入管理介面後，前往 **API 管理 → API 列表**
2. 點擊右上角 **「匯入註冊/組合API檔案」**
3. 選擇本資料夾內的 `apis-export.json`
4. 匯入完成後，選取全部 API → 點 **「啟動」**

### 3. 設定環境變數

```bash
cp .env.example .env
# 編輯 .env，填入你的 Dify API Key
```

### 4. 啟動前端

```bash
npm install
npm run dev
```

---

## 已設定的 API 路由

| API 名稱 | Proxy Path | 目標 URL | Method |
|---|---|---|---|
| `finmind-stock` | `/finmind/api/v4/data` | `https://api.finmindtrade.com/api/v4/data` | GET |
| `dify-workflow` | `/dify/v1/workflows/run` | `http://host.docker.internal/v1/workflows/run` | POST |

## 注意事項

- **Finmind API**：免費版每天 600 次請求限制，本專案已在前端實作 localStorage 快取降低呼叫頻率
- **Dify API Key**：需自行在 Dify 後台建立工作流程並取得 Key，填入 `.env`
- **DigiRunner 資料持久化**：設定存於 Docker volume `digirunner_data`，重啟不會消失
