// 开发模式启动器：先后拉起 Vite 开发服务器与 Electron 主进程。
// Electron 通过 ELECTRON_DEV=1 环境变量判断加载 http://localhost:5173 而非打包后的 file://。
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 本文件位于 scripts/ 下，工程根目录是它的上一级
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, ELECTRON_DEV: '1' }

let electron = null
const vite = spawn('npx', ['vite'], { cwd: root, stdio: 'inherit', shell: true })
vite.on('error', (e) => { console.error('[dev] vite 启动失败：', e); process.exit(1) })

// 等 Vite 起来再启动 Electron，避免首屏 404
setTimeout(() => {
  electron = spawn('npx', ['electron', '.'], { cwd: root, stdio: 'inherit', shell: true, env })
  electron.on('error', (e) => { console.error('[dev] electron 启动失败：', e); process.exit(1) })
}, 4000)

// 退出时把两个子进程都收掉：原来只 kill vite，electron 会成为孤儿继续占着窗口和 5173 端口。
// 注意 shell:true 下 spawn 的是命令解释器包装进程，kill 只作用于包装层；
// Windows 上若要彻底清进程树需用 taskkill /T，此处保持最小改动。
const shutdown = () => {
  try { vite.kill() } catch {}
  if (electron) { try { electron.kill() } catch {} }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
