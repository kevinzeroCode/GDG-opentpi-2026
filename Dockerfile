# 使用 Node.js 官方鏡像
FROM node:20-alpine

# 設定容器內的工作目錄
WORKDIR /app

# 複製 package.json 並安裝依賴
COPY package*.json ./
RUN npm install

# 複製所有專案內容
COPY . .

# 曝露 Vite 預設端口
EXPOSE 5173

# 啟動開發伺服器，並允許外部連線
CMD ["npm", "run", "dev", "--", "--host"]