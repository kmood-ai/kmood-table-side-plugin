import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  // 加载环境变量（第三个参数 '' 表示加载所有变量，不限 VITE_ 前缀）
  const env = loadEnv(mode, process.cwd(), '')

  // dev 模式(serve)下 base 保持默认 '/'，仅 build 时使用环境变量中的 CDN 地址
  const base = command === 'build' ? (env.BASE_URL || './') : '/'

  return {
    base,
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
    },
  }
})
