# QuantDashboard AI - 智能量化分析助手 📈

這是一個基於 **React**、**Vite**、**Docker** 與 **Dify.ai** 工作流建立的台股量化分析儀表板。使用者可以透過與 AI Bot 對話，即時獲取股票技術指標（如 RSI、MA5、股價趨勢）並以直觀的動態儀表板呈現。

![QuantDashboard Preview](https://via.placeholder.com/800x450.png?text=QuantDashboard+AI+Preview) ## 🌟 核心功能
- **智能對話接口**：類 ChatGPT 的 Bot 介面，輸入台股代號（如 `2330`）即可觸發分析。
- **即時指標解析**：串接 Dify 工作流，自動爬取並解析 Yahoo Finance 數據。
- **動態視覺化**：
  - **RSI 強度儀表板**：直觀顯示市場超買或超賣狀態。
  - **量化數據卡片**：即時顯示目前股價、MA5 均線與多空趨勢判斷。
- **全容器化部署**：支援 Docker Compose，環境配置一鍵完成。

## 🛠️ 技術棧
- **Frontend**: React 18, Vite, Tailwind CSS
- **Visualization**: ApexCharts (RadialBar), Lucide React (Icons)
- **AI Engine**: [Dify.ai](https://dify.ai/) (Workflow Mode)
- **Container**: Docker, Docker Compose

## 🚀 快速啟動

### 1. 複製專案
```bash
git clone [https://github.com/kevinzeroCode/GDG-opentpi-2026.git](https://github.com/kevinzeroCode/GDG-opentpi-2026.git)
cd GDG-opentpi-2026
```
### 2. 環境設定
在根目錄建立 .env 檔案並填入你的 Dify API 資訊：
```bash
VITE_DIFY_API_URL=[http://host.docker.internal/v1](http://host.docker.internal/v1)
VITE_DIFY_API_KEY=your_dify_api_key_here
```
### 3. 啟動服務
使用 Docker Compose 一鍵構建並運行：
```bash
docker-compose up --build
```
啟動後，開啟瀏覽器造訪：http://localhost:5173

### 📂 專案結構
```bash
├── src/
│   ├── components/       # UI 組件 (GaugeChart, Dashboard)
│   ├── hooks/            # 自定義 Hook (API 請求邏輯)
│   ├── utils/            # 解析器 (Regex Text Parser)
│   └── App.jsx           # 主對話介面邏輯
├── docker-compose.yml    # Docker 配置
└── Dockerfile            # 前端構建文件
```

### 📝 免責聲明
本專案僅供學習與技術研究使用，所提供之量化數據皆為技術指標解析，不構成任何投資建議。投資人應獨立判斷並自負風險。