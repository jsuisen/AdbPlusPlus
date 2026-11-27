// 离线日志：设备端 nohup logcat 后台常驻，adb 断开/应用退出都不影响写盘；
// 停止时按落盘的 .pid 文件精确 kill -INT（刷盘），再按需 pull 到本机。
// 设备端 sh 会解析 adb shell 的参数，故用户可控 token 统一经 offlinelog-safety.js 白名单。
import { ipcMain } from 'electron'
import {
  OFFLINELOG_START, OFFLINELOG_LIST, OFFLINELOG_PULL, OFFLINELOG_RM, OFFLINELOG_STOP,
  OFFLINELOG_DUMP, OFFLINELOG_STARTED, OFFLINELOG_STOPPED
} from '../shared/ipc-channels.js'
import fs from 'node:fs'
import path from 'node:path'
import { run } from './tools.js'
import { safeLogcatTokens, safeDevicePath } from './offlinelog-safety.js'
import { safePid, sq, suWrap, backgroundCmd, readPid, shellArgv, alive, stopByPid } from './device-background.js'

const FLUSH_WAIT = 800
const DEFAULT_DIR = '/sdcard/adbpp_logs/'
const sessions = new Map()   // serial -> { devicePath, pidPath, asRoot }
let winRef = null

const pad2 = (n) => String(n).padStart(2, '0')
const ymdhms = (d) => '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds())
const sanitize = (s) => (s || '').replace(/[^a-z0-9._-]/gi, '_')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function deviceLabel(serial) {
  let model = ''
  try {
    const r = await run('adb.exe', ['-s', serial, 'shell', 'getprop', 'ro.product.model'])
    model = r.code === 0 ? (r.out || '').trim() : ''
  } catch {}
  const m = sanitize(model)
  const s = sanitize(serial)
  return m ? m + '_' + s : s
}

// 后台命令：有 nohup 用 nohup，没有就直接 &（重定向已断开终端，仍可脱离会话）。
// $! 写入 .pid 文件，使「停止」不依赖本次进程内存，也不误杀别的 logcat。
function buildBackgroundCmd(args, devicePath, pidPath, pointerPath, pid) {
  const toks = safeLogcatTokens(args)
  const pidArg = pid ? ['--pid=' + pid] : []
  const core = `logcat ${[...pidArg, ...toks].join(' ')} > ${sq(devicePath)} 2>&1`
  return backgroundCmd(core, pidPath, pointerPath)
}

export function registerOfflineLogIpc(win) {
  winRef = win

  ipcMain.handle(OFFLINELOG_START, async (_e, { serial, deviceDir, args, asRoot, pid }) => {
    if (!serial) throw new Error('serial 必填')
    const dir = safeDevicePath((deviceDir && deviceDir.trim()) || DEFAULT_DIR)
    const pidNum = safePid(pid)
    const root = !!asRoot
    const mkdirArgv = root ? ['-s', serial, 'shell', ...suWrap('mkdir -p ' + sq(dir))] : ['-s', serial, 'shell', 'mkdir', '-p', dir]
    await run('adb.exe', mkdirArgv)
    const chk = await run('adb.exe', shellArgv(serial, 'command -v logcat', root))
    if (chk.code !== 0 || !chk.out.trim()) throw new Error('设备未找到 logcat 命令')
    const label = await deviceLabel(serial)
    const ts = ymdhms(new Date())
    const rand = Math.random().toString(16).slice(2, 6)
    const devicePath = safeDevicePath(dir.replace(/\/$/, '') + '/' + label + '_' + ts + '_' + rand + '.log')
    const pidPath = safeDevicePath(devicePath + '.pid')
    // 固定指针文件：应用重启 / 换设备后仍能按目录找到最近一次后台 logcat 的 PID
    const pointerPath = safeDevicePath(dir.replace(/\/$/, '') + '/current.pid')
    const r = await run('adb.exe', shellArgv(serial, buildBackgroundCmd(args, devicePath, pidPath, pointerPath, pidNum), root))
    if (r.code !== 0) throw new Error('启动失败：' + (r.err || r.code))
    const startedPid = await readPid(serial, pidPath, root)
    if (!startedPid) throw new Error('已下发后台命令，但未读到 PID 文件；请检查设备是否支持 nohup/重定向，或清理残留进程')
    if (!(await alive(serial, startedPid, root))) throw new Error('后台 logcat 启动后立即退出，请检查参数 / root 权限 / 设备存储')
    sessions.set(serial, { devicePath, pidPath, pointerPath, asRoot: root })
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(OFFLINELOG_STARTED, { serial, devicePath, pid: startedPid })
    return { devicePath, pidPath, pid: startedPid, label, ts }
  })

  ipcMain.handle(OFFLINELOG_STOP, async (_e, { serial, devicePath, pidPath, deviceDir, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const s = sessions.get(serial) || {}
    const logPath = devicePath || s.devicePath || ''
    const root = asRoot == null ? !!s.asRoot : !!asRoot
    // 应用重启后 sessions 为空：按设备目录里的 current.pid 找回后台进程，仍能精确停止
    const pointerPath = s.pointerPath || safeDevicePath((deviceDir || DEFAULT_DIR).replace(/\/$/, '') + '/current.pid')
    const pPath = safeDevicePath(pidPath || s.pidPath || (logPath ? logPath + '.pid' : pointerPath))
    // PID 文件丢失（设备重启 / 用户手删）才走 pkill 兜底，可能同时影响其他 logcat 会话。
    const { pid, fallback } = await stopByPid(serial, {
      pidPath: pPath, pointerPath, asRoot: root, fallbackCmd: 'pkill -INT logcat'
    })
    sessions.delete(serial)
    await sleep(FLUSH_WAIT)
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(OFFLINELOG_STOPPED, { serial, devicePath: logPath, fallback })
    return { devicePath: logPath, pid, fallback }
  })

  ipcMain.handle(OFFLINELOG_LIST, async (_e, { serial, deviceDir, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const dir = safeDevicePath((deviceDir && deviceDir.trim()) || DEFAULT_DIR)
    const base = dir.replace(/\/$/, '')
    const argv = asRoot
      ? ['-s', serial, 'shell', ...suWrap('ls -l ' + sq(base) + '/*.log')]
      : ['-s', serial, 'shell', 'ls', '-l', base + '/*.log']
    const r = await run('adb.exe', argv)
    if (r.code !== 0) return { items: [] }
    const items = []
    for (const ln of r.out.split(/\r?\n/)) {
      const f = ln.trim().split(/\s+/)
      if (f.length < 8) continue
      const full = f[f.length - 1]
      if (!full.endsWith('.log')) continue
      items.push({ name: path.basename(full), size: f[4], mtime: f[5] + ' ' + f[6], path: full })
    }
    // 重启恢复：按 current.pid 探活，前端据此还原「抓日志中」状态
    const pointerPath = safeDevicePath(base + '/current.pid')
    const saved = sessions.get(serial)
    const p = await readPid(serial, saved && saved.pointerPath ? saved.pointerPath : pointerPath, !!asRoot)
    const running = !!(p && await alive(serial, p, !!asRoot))
    return { items, running, pid: running ? p : '' }
  })

  ipcMain.handle(OFFLINELOG_PULL, async (_e, { serial, devicePath, localDir, asRoot }) => {
    if (!serial || !devicePath || !localDir) throw new Error('serial / devicePath / localDir 必填')
    const p = safeDevicePath(devicePath)
    if (asRoot) await run('adb.exe', ['-s', serial, 'shell', ...suWrap('chmod 644 ' + sq(p))]).catch(() => {})
    fs.mkdirSync(localDir, { recursive: true })
    const localPath = path.join(localDir, path.basename(p))
    const r = await run('adb.exe', ['-s', serial, 'pull', p, localPath])
    if (r.code !== 0) throw new Error('pull 失败：' + (r.err || r.code))
    return { localPath }
  })

  ipcMain.handle(OFFLINELOG_RM, async (_e, { serial, devicePath, asRoot }) => {
    if (!serial || !devicePath) throw new Error('serial / devicePath 必填')
    const p = safeDevicePath(devicePath)
    const cmd = `rm -f ${sq(p)} ${sq(p + '.pid')}`
    const r = await run('adb.exe', shellArgv(serial, cmd, !!asRoot))
    if (r.code !== 0) throw new Error('删除失败：' + (r.err || r.code))
    return { ok: true }
  })

  // 立即导出当前缓冲日志：logcat -d [--pid=123] <args> *:V，文本回渲染层落盘。
  ipcMain.handle(OFFLINELOG_DUMP, async (_e, { serial, args, pid, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const pidNum = safePid(pid)
    const toks = safeLogcatTokens(args)
    const parts = ['logcat', '-d']
    if (pidNum) parts.push('--pid=' + pidNum)
    parts.push(...toks)
    const cmd = parts.join(' ')
    const r = await run('adb.exe', shellArgv(serial, cmd, !!asRoot), { timeoutMs: 60000 })
    if (r.code !== 0) throw new Error('导出失败：' + (r.err || r.code))
    return { text: r.out || '', command: cmd }
  })
}
