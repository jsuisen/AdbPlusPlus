// 开发模式启动器：先后拉起 Vite 开发服务器与 Electron 主进程。
// Electron 通过 ELECTRON_DEV=1 环境变量判断加载 http://localhost:5173 而非打包后的 file://。
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 本文件位于 scripts/ 下，工程根目录是它的上一级
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, ELECTRON_DEV: '1' }

const vite = spawn('npx', ['vite'], { cwd: root, stdio: 'inherit', shell: true })
vite.on('error', (e) => { console.error('[dev] vite 启动失败：', e); process.exit(1) })

// 等 Vite 起来再启动 Electron，避免首屏 404
setTimeout(() => {
  const electron = spawn('npx', ['electron', '.'], { cwd: root, stdio: 'inherit', shell: true, env })
  electron.on('error', (e) => { console.error('[dev] electron 启动失败：', e); process.exit(1) })
}, 4000)

const shutdown = () => { try { vite.kill() } catch {}; process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
