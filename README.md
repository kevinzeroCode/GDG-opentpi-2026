# QuantDashboard AI - 智能量化分析助手

基於 **React + Vite** 前端與 **Dify.ai** 工作流後端的台股量化分析儀表板。透過對話式介面輸入股票代號，即時取得技術指標分析，並以財金專家觀點產生白話解讀。

## 核心功能

### 對話式分析
- 類 ChatGPT 介面，輸入台股代號（如 `2330`）即可觸發分析
- **財金專家解說**：自動將 RSI、KD、MACD 等指標轉化為淺顯易懂的技術面分析報告，適合無財金背景的使用者
- 查詢失敗時提供明確的錯誤回饋與重試機制

### 即時儀表板（4 個分頁）
| 分頁 | 內容 |
|------|------|
| **總覽** | 股價、MA5 均線、趨勢判斷、RSI 儀表板、價格走勢圖 |
| **技術指標** | KD 圖表、MACD 圖表、綜合訊號判定、智慧警報設定 |
| **歷史趨勢** | RSI / KD / MACD 歷史折線圖、日期篩選、年化報酬率、多股比較模式 |
| **自選** | 自選清單管理、持股數量輸入、投資組合總市值、持股配比圓餅圖 |

### 自選清單 & 投資組合
- 在總覽頁點擊星號加入自選
- 可輸入每檔持股數量，即時計算總市值
- 持股配比圓餅圖直觀呈現資產分配
- 一鍵批次查詢所有自選股

### 歷史趨勢
- 自動記錄每次查詢結果
- 預設篩選：1 週 / 1 月 / 3 月 / 1 年 / 全部
- 自訂日期範圍
- 年化報酬率計算（綠漲紅跌）
- Ticker 標籤顯示暱稱（如「台積電」），可點 X 刪除歷史
- 多股比較模式（最多 4 檔）

### 智慧警報
- 自訂指標條件（RSI > 70、價格 < 500 等）
- 瀏覽器推播通知

### 其他
- RWD 響應式設計，支援桌面與行動裝置
- 匯出儀表板為 PNG 截圖
- 載入中動畫（聊天氣泡 + 骨架屏）

## 技術棧
- **Frontend**: React 18, Vite, Tailwind CSS
- **Charts**: ApexCharts (react-apexcharts)
- **Icons**: Lucide React
- **AI Engine**: [Dify.ai](https://dify.ai/) (Workflow Mode)
- **Data Source**: Yahoo Finance API
- **Container**: Docker, Docker Compose

## 快速啟動

### 1. 複製專案
```bash
git clone https://github.com/kevinzeroCode/GDG-opentpi-2026.git
cd GDG-opentpi-2026
```

### 2. 環境設定
在根目錄建立 `.env` 檔案：
```bash
VITE_DIFY_API_URL=http://localhost/v1
VITE_DIFY_API_KEY=your_dify_api_key_here
```

### 3. 啟動 Dify 服務
確保 Docker 中的 Dify 已啟動並匯入 `dify_config/儀錶板測試.yml` 工作流，**發布後**才能透過 API 呼叫。

### 4. 啟動前端
```bash
npm install
npm run dev
```
開啟瀏覽器造訪 http://localhost:5173

## 專案結構
```
├── src/
│   ├── components/Dashboard/   # 圖表元件
│   │   ├── GaugeChart.jsx      #   RSI 儀表板
│   │   ├── KDChart.jsx         #   KD 指標圖
│   │   ├── MACDChart.jsx       #   MACD 圖表
│   │   ├── PriceChart.jsx      #   價格走勢圖
│   │   └── HistoryChart.jsx    #   歷史趨勢（含比較模式）
│   ├── hooks/
│   │   └── useDifyAPI.js       # Dify API Hook（含錯誤處理）
│   ├── utils/
│   │   ├── parser.js           # 文字解析器
│   │   ├── commentary.js       # 財金專家解說產生器
│   │   ├── history.js          # 歷史紀錄管理
│   │   ├── watchlist.js        # 自選清單（含持股數量）
│   │   ├── alerts.js           # 智慧警報
│   │   └── tickerNames.js      # 股票代碼暱稱對照
│   └── App.jsx                 # 主介面
├── dify_config/                # Dify 工作流設定檔
├── docker-compose.yml
└── Dockerfile
```

## 免責聲明
本專案僅供學習與技術研究使用，所提供之量化數據皆為技術指標解析，不構成任何投資建議。投資人應獨立判斷並自負風險。
