import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/dify': {
          target: 'https://api.dify.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/dify/, ''),
          headers: {
            Authorization: `Bearer ${env.VITE_DIFY_API_KEY}`,
          },
        },
        '/gnews': {
          target: 'https://news.google.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gnews\/?/, '/rss/search'),
        },
        '/finmind': {
          target: 'https://api.finmindtrade.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/finmind/, ''),
        },
        '/twse': 'http://digirunner:18080',
      },
    },
  }
})