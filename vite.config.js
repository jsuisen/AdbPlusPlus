import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // 开发用 '/'，打包用相对路径（保证 Electron 以 file:// 加载时资源可寻址）
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      // 渲染进程源码根；@shared 指向主进程/渲染进程共用的 IPC 通道常量
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    // dev.js 启动时探测可用端口并通过 DEV_PORT 注入；直跑 vite 时回退 5173
    port: Number(process.env.DEV_PORT) || 5173,
    strictPort: true
  }
}))
