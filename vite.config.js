 import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/twse': 'http://digirunner:18080',
        '/dify': 'http://digirunner:18080',
        '/finmind': 'http://digirunner:18080',
      },
    },
  })