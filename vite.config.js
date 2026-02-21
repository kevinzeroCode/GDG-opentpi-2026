import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 必須為 true，Docker 才能映射端口
    port: 5173,
    watch: {
      usePolling: true, // 確保檔案變動會自動更新
    },
  },
})