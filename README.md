# QuantDashboard AI — 智能台股量化分析助手

基於 **React + Vite** 前端、**Dify.ai** AI 工作流、**DigiRunner** API Gateway 的台股量化分析儀表板。透過對話式介面輸入股票代號或中文名稱，即時取得技術指標分析，並以財金專家觀點產生白話解讀。

---

## 核心功能

### 對話式 AI 分析
- 類 ChatGPT 介面，支援輸入台股代號（`2330`）或中文名稱（`台積電`、`中華電信`）
- 自動模糊比對中文名稱 → 代號（如「聯發科技」→ `2454`）
- **財金專家解說**：RSI、KD、MACD 等指標自動轉化為淺顯易懂的技術面分析報告
- 一次輸入多檔代號（如 `2330 2317`）批次分析
- 一般財經問答（非個股查詢時由 GPT 回答通用投資問題）

### 即時儀表板（4 個分頁）

| 分頁 | 內容 |
|------|------|
| **總覽** | 即時股價、MA5、趨勢判斷、RSI 儀表板、即時行情卡（每 5 秒更新）、K 線圖 |
| **技術指標** | KD 圖表、MACD 圖表、綜合訊號判定（多/空/中性）、智慧警報設定 |
| **歷史趨勢** | RSI / KD / MACD 歷史折線圖、日期篩選、年化報酬率、多股比較（最多 4 檔） |
| **自選** | 自選清單 + 即時價格自動更新（30 秒）、持股數與平均成本輸入、未實現損益計算、投資組合圓餅圖 |

### K 線圖（CandlestickChart）
- 台股 K 棒（漲紅跌綠，台灣慣例）
- 底部成交量 bar（佔圖表下方 20%）
- MA5 / MA20 / MA60 均線可獨立切換顯示
- 時間軸：1D / 1W / 1M / 3M / 6M / 1Y / 3Y / 5Y
- 可縮放、拖曳平移，切換時間段不重置縮放狀態
- Tooltip 同時顯示 OHLC + 各均線值 + 成交量
- localStorage 快取，增量更新（只抓新增日期），避免重複下載

### 自選清單 & 投資組合
- 總覽頁點擊星號加入自選
- 盤中每 30 秒自動抓取所有自選股即時價格（含漲跌幅）
- 輸入持股數量 + 平均成本，自動計算未實現損益（金額 + %）
- 投資組合總市值與總損益彙總
- 持股配比圓餅圖
- 一鍵批次查詢所有自選股

### 智慧警報
- 自訂指標條件（`RSI > 70`、`價格 < 500`、`MACD > 0` 等）
- 瀏覽器推播通知
- EmailJS 警報信箱通知
- 背景每 5 秒自動輪詢 price 類型警報（不需手動查詢）

### 其他
- 匯出儀表板為 PNG 截圖
- 載入中動畫（氣泡 + 骨架屏）
- 響應式設計（桌面 / 手機）

---

## 技術架構

```
使用者
  ↓
React + Vite (port 5173)
  ↓
DigiRunner API Gateway (port 31080)
  ├── /dify/v1/workflows/run  →  Dify AI (port 80)
  ├── /finmind/api/v4/data    →  FinMind API (歷史 K 線)
  └── /twse/stock/api/...     →  TWSE 即時行情
```

### 技術棧

| 分類 | 技術 |
|------|------|
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | ApexCharts (react-apexcharts) |
| Icons | Lucide React |
| AI Engine | Dify.ai Workflow + GPT-5.2 |
| 歷史數據 | FinMind API (台股日 K、三大法人等) |
| 即時行情 | TWSE mis.twse.com.tw |
| API Gateway | DigiRunner (Docker) |
| Email 通知 | EmailJS |
| 截圖匯出 | html2canvas |

---

## 快速啟動

### 前置需求
- Node.js 18+
- Docker Desktop

### 1. 複製專案
```bash
git clone https://github.com/kevinzeroCode/GDG-opentpi-2026.git
cd GDG-opentpi-2026
```

### 2. 環境設定
複製 `.env.example` 為 `.env` 並填入實際值：
```bash
cp .env.example .env
```

| 變數 | 說明 |
|------|------|
| `VITE_DIFY_API_URL` | Dify API 位址（預設透過 DigiRunner: `http://localhost:31080/dify/v1`） |
| `VITE_DIFY_API_KEY` | Dify 後台 → 應用程式 → API 金鑰 |
| `VITE_EMAILJS_SERVICE_ID` | EmailJS Service ID |
| `VITE_EMAILJS_TEMPLATE_ID` | EmailJS Template ID |
| `VITE_EMAILJS_PUBLIC_KEY` | EmailJS Public Key |

### 3. 啟動 DigiRunner（API Gateway）
```bash
docker-compose up -d digirunner
```
首次啟動後，進入 DigiRunner 管理介面（`http://localhost:31080`）匯入 `digirunner/apis-export.json`。
> 詳細說明請參考 [digirunner/README.md](digirunner/README.md)

### 4. 啟動 Dify AI 服務
確保 Dify 已於 Docker 啟動（`http://localhost`），並匯入 `dify_config/儀錶板測試.yml` 工作流後**發布**。

### 5. 啟動前端
```bash
npm install
npm run dev
```
開啟瀏覽器造訪 [http://localhost:5173](http://localhost:5173)

---

## 專案結構

```
├── src/
│   ├── components/Dashboard/
│   │   ├── CandlestickChart.jsx  # K 線圖（成交量 + MA 均線）
│   │   ├── GaugeChart.jsx        # RSI 儀表板
│   │   ├── KDChart.jsx           # KD 指標圖
│   │   ├── MACDChart.jsx         # MACD 圖表
│   │   ├── PriceChart.jsx        # 價格走勢圖
│   │   └── HistoryChart.jsx      # 歷史趨勢（含比較模式）
│   ├── hooks/
│   │   ├── useDifyAPI.js         # Dify API Hook
│   │   └── useTWSELive.js        # TWSE 即時行情 Hook（5 秒輪詢）
│   ├── utils/
│   │   ├── stockCandles.js       # FinMind K 線資料（含快取）
│   │   ├── twseLive.js           # TWSE 即時行情
│   │   ├── parser.js             # 指標文字解析器
│   │   ├── commentary.js         # 財金解說產生器
│   │   ├── history.js            # 歷史查詢紀錄
│   │   ├── watchlist.js          # 自選清單（持股 + 成本 + 損益）
│   │   ├── alerts.js             # 智慧警報邏輯
│   │   ├── emailAlert.js         # EmailJS 通知
│   │   └── tickerNames.js        # 中文名稱 ↔ 代號對照（含模糊比對）
│   └── App.jsx                   # 主介面
├── dify_config/
│   └── 儀錶板測試.yml             # Dify 工作流（匯入用）
├── digirunner/
│   ├── apis-export.json          # DigiRunner 路由設定（匯入用）
│   └── README.md
├── docker-compose.yml
├── .env.example
└── vite.config.js
```

---

## 免責聲明

本專案僅供學習與技術研究使用，所提供之量化數據皆為技術指標解析，不構成任何投資建議。投資人應獨立判斷並自負風險。
