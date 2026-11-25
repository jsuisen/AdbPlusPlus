// 开发模式启动器：先探测可用端口，再拉起 Vite 开发服务器与 Electron 主进程。
// Electron 通过 ELECTRON_DEV=1 判断加载 http://localhost:<DEV_PORT> 而非打包后的 file://。
// Windows 上 Hyper-V/WSL 会动态保留整段 TCP 端口（netsh interface ipv4 show excludedportrange），
// 固定 5173 可能落在保留区间内导致 EACCES；这里从 5173 起探测第一个可绑定端口，
// 通过 DEV_PORT 环境变量让 Vite 与 Electron 使用同一端口。
import { spawn } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// 本文件位于 scripts/ 下，工程根目录是它的上一级
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 端口能否在 ::1 上绑定（Vite 默认监听 localhost，Windows 下优先解析为 ::1）
function canBind(port) {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '::1', () => srv.close(() => resolve(true)))
  })
}

// 从 start 起连续探测 span 个端口，返回第一个可用的；全不可用则抛错。
async function pickPort(start = 5173, span = 128) {
  for (let p = start; p < start + span; p++) {
    if (await canBind(p)) return p
  }
  throw new Error(`[dev] ${start}~${start + span - 1} 均无可用端口，请检查系统保留端口区间`)
}

const port = await pickPort()
process.env.DEV_PORT = String(port)
console.log(`[dev] Vite 端口 ${port}${port === 5173 ? '' : '（5173 被系统保留或占用，已自动顺延）'}`)

const env = { ...process.env, ELECTRON_DEV: '1' }

let electron = null
const vite = spawn('npx', ['vite'], { cwd: root, stdio: 'inherit', shell: true })
vite.on('error', (e) => { console.error('[dev] vite 启动失败：', e); process.exit(1) })

// 等 Vite 起来再启动 Electron，避免首屏 404
setTimeout(() => {
  electron = spawn('npx', ['electron', '.'], { cwd: root, stdio: 'inherit', shell: true, env })
  electron.on('error', (e) => { console.error('[dev] electron 启动失败：', e); process.exit(1) })
}, 4000)

// 退出时把两个子进程都收掉：原来只 kill vite，electron 会成为孤儿继续占着窗口和端口。
// 注意 shell:true 下 spawn 的是命令解释器包装进程，kill 只作用于包装层；
// Windows 上若要彻底清进程树需用 taskkill /T，此处保持最小改动。
const shutdown = () => {
  try { vite.kill() } catch {}
  if (electron) { try { electron.kill() } catch {} }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
