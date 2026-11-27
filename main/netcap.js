// 网络抓包：设备端 nohup tcpdump 常驻写盘，adb 断开 / 应用退出都不中断；
// 停止按 PID 文件精确 kill -INT 刷盘，按需 pull 到本机。
// 权限失败自动探测 su 并以 root 重启（root 标记落设备，重启软件后仍能精确停止）。
import { ipcMain } from 'electron'
import { NETCAP_START, NETCAP_STOPPED, NETCAP_STARTED, NETCAP_STOP, NETCAP_PULL, NETCAP_LIST, NETCAP_RM } from '../shared/ipc-channels.js'
import fs from 'node:fs'
import path from 'node:path'
import { run } from './tools.js'
import { safeTokens, safeDevicePath, sq, suWrap } from './netcap-safety.js'
import { backgroundCmd, readPid, shellArgv, alive, stopByPid } from './device-background.js'

const FLUSH_WAIT = 800
const DEFAULT_DIR = '/sdcard/adbpp_captures/'
const sessions = new Map()    // serial -> { devicePath, pidPath, pointerPath, errPath, asRoot }
let winRef = null

const pad2 = (n) => String(n).padStart(2, '0')
const ymdhms = (d) => '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds())
const sanitize = (s) => (s || '').replace(/[^a-z0-9._-]/gi, '_')

function dirOf(deviceDir) { return safeDevicePath((deviceDir && deviceDir.trim()) || DEFAULT_DIR) }
function baseOf(dir) { return dir.replace(/\/$/, '') }

function tcpdumpCmdStr(args, devicePath) {
  const toks = safeTokens(args)
  const out = []
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '-w') { i++; continue }
    out.push(toks[i])
  }
  return 'tcpdump ' + out.join(' ') + ' -w ' + sq(safeDevicePath(devicePath))
}

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

async function readSmallFile(serial, p, root) {
  const r = await run('adb.exe', shellArgv(serial, 'cat ' + sq(p), !!root)).catch(() => ({ code: -1, out: '' }))
  return r.code === 0 ? (r.out || '').trim() : ''
}

// 设备是否可用 su 提权。adb shell 交互授权弹窗可能挂起，给 4 秒兜底。
async function hasRoot(serial) {
  const r = await run('adb.exe', shellArgv(serial, 'id -u', true), { timeoutMs: 4000 }).catch(() => ({ code: -1, out: '' }))
  return r.code === 0 && (r.out || '').trim() === '0'
}

// 本次抓包是否 root：优先读设备目录的 current.root，应用重启后也能正确 kill root 进程
async function effectiveRoot(serial, deviceDir, fallback) {
  const flagPath = safeDevicePath(baseOf(dirOf(deviceDir)) + '/current.root')
  let v = await readSmallFile(serial, flagPath, !!fallback)
  if (!v) v = await readSmallFile(serial, flagPath, !fallback)
  if (v === '1') return true
  if (v === '0') return false
  return !!fallback
}

async function runningInfo(serial, deviceDir, root) {
  const pointerPath = safeDevicePath(baseOf(dirOf(deviceDir)) + '/current.pid')
  const saved = sessions.get(serial)
  const p = await readPid(serial, saved && saved.pointerPath ? saved.pointerPath : pointerPath, !!root)
  const running = !!(p && await alive(serial, p, !!root))
  return { running, pid: running ? p : '' }
}

// 启动一次后台 tcpdump；不在这里决定 root 回退，交给调用方按 errText 判断
async function launchCapture({ serial, dir, args, root, label }) {
  const base = baseOf(dir)
  const ts = ymdhms(new Date())
  const rand = Math.random().toString(16).slice(2, 6)
  const devicePath = safeDevicePath(base + '/' + label + '_' + ts + '_' + rand + '.pcap')
  const pidPath = safeDevicePath(devicePath + '.pid')
  const errPath = safeDevicePath(devicePath + '.err')
  const pointerPath = safeDevicePath(base + '/current.pid')
  const rootFlagPath = safeDevicePath(base + '/current.root')
  // stderr 落 .err 文件而非 /dev/null：启动失败时能把 tcpdump 的真实错误回给界面
  const coreCmd = `${tcpdumpCmdStr(args, devicePath)} >/dev/null 2> ${sq(errPath)}`
  const r = await run('adb.exe', shellArgv(serial, backgroundCmd(coreCmd, pidPath, pointerPath, rootFlagPath, root ? '1' : '0'), root))
  if (r.code !== 0) throw new Error('启动失败：' + (r.err || r.code))
  let startedPid = await readPid(serial, pidPath, root)
  if (!startedPid) startedPid = await readPid(serial, pidPath, !root)
  const ok = !!(startedPid && await alive(serial, startedPid, root))
  const errText = ok ? '' : ((await readSmallFile(serial, errPath, root)) || (await readSmallFile(serial, errPath, !root)))
  return { devicePath, pidPath, errPath, pointerPath, ts, startedPid, alive: ok, errText, root }
}

export function registerNetcapIpc(win) {
  winRef = win

  ipcMain.handle(NETCAP_START, async (_e, { serial, deviceDir, args, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const dir = dirOf(deviceDir)
    const root0 = !!asRoot
    // 同设备已有会话：先精确停掉旧进程，避免重复抓包（不用 pkill，免误伤别的 tcpdump）
    if (sessions.has(serial)) {
      const old = sessions.get(serial)
      try {
        await stopByPid(serial, { pidPath: old.pidPath, pointerPath: old.pointerPath, asRoot: old.asRoot, fallbackCmd: '' })
      } catch {}
      sessions.delete(serial)
    }
    const mkdirArgv = root0 ? ['-s', serial, 'shell', ...suWrap('mkdir -p ' + sq(dir))] : ['-s', serial, 'shell', 'mkdir', '-p', dir]
    await run('adb.exe', mkdirArgv)
    let chk = await run('adb.exe', shellArgv(serial, 'command -v tcpdump', root0))
    if ((chk.code !== 0 || !chk.out.trim()) && !root0 && await hasRoot(serial)) {
      chk = await run('adb.exe', shellArgv(serial, 'command -v tcpdump', true))
    }
    if (chk.code !== 0 || !chk.out.trim()) throw new Error('设备未找到 tcpdump 命令，请先预装/推送后再抓包')

    const label = await deviceLabel(serial)
    let info = await launchCapture({ serial, dir, args, root: root0, label })
    // 典型场景：tcpdump 已安装但 shell 用户无 CAP_NET_RAW → "Operation not permitted"。
    // 设备有 root 时自动提权重试，用户不必先去设置里勾 captureAsRoot。
    if (!info.alive && !root0 && /permission|not permitted|denied/i.test(info.errText) && await hasRoot(serial)) {
      info = await launchCapture({ serial, dir, args, root: true, label })
    }
    if (!info.alive) {
      const detail = info.errText ? info.errText.slice(0, 400) : '请检查 root 权限 / 参数 / 设备存储'
      throw new Error('tcpdump 启动后立即退出：' + detail)
    }
    sessions.set(serial, { devicePath: info.devicePath, pidPath: info.pidPath, pointerPath: info.pointerPath, errPath: info.errPath, asRoot: info.root })
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_STARTED, { serial, devicePath: info.devicePath, pid: info.startedPid, root: info.root })
    return { devicePath: info.devicePath, label, ts: info.ts, pid: info.startedPid, root: info.root }
  })

  // 停止：按 PID 精确 kill -INT 刷盘；PID 文件丢失才 pkill 兜底（此时可能误伤其他 tcpdump）
  ipcMain.handle(NETCAP_STOP, async (_e, { serial, devicePath, pidPath, deviceDir, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const s = sessions.get(serial) || {}
    const logPath = devicePath || s.devicePath || ''
    const fallbackRoot = s.asRoot == null ? !!asRoot : s.asRoot
    const root = await effectiveRoot(serial, deviceDir, fallbackRoot)
    const pointerPath = s.pointerPath || safeDevicePath(baseOf(dirOf(deviceDir)) + '/current.pid')
    const pPath = safeDevicePath(pidPath || s.pidPath || (logPath ? logPath + '.pid' : pointerPath))
    const { pid, fallback } = await stopByPid(serial, {
      pidPath: pPath, pointerPath, asRoot: root, fallbackCmd: 'pkill -INT tcpdump'
    })
    sessions.delete(serial)
    await new Promise((r) => setTimeout(r, FLUSH_WAIT))
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_STOPPED, { serial, devicePath: logPath, fallback })
    return { devicePath: logPath, pid, fallback }
  })

  // 按需下载（pull）到本机：普通 pull 失败时补一次 su chmod 再拉
  ipcMain.handle(NETCAP_PULL, async (_e, { serial, devicePath, localDir, asRoot }) => {
    if (!serial || !devicePath || !localDir) throw new Error('serial / devicePath / localDir 必填')
    const p = safeDevicePath(devicePath)
    fs.mkdirSync(localDir, { recursive: true })
    const localPath = path.join(localDir, path.basename(p))
    let r = await run('adb.exe', ['-s', serial, 'pull', p, localPath])
    if (r.code !== 0 && !asRoot) {
      await run('adb.exe', ['-s', serial, 'shell', ...suWrap('chmod 644 ' + sq(p))]).catch(() => {})
      r = await run('adb.exe', ['-s', serial, 'pull', p, localPath])
    }
    if (r.code !== 0) throw new Error('pull 失败：' + (r.err || r.code))
    return { localPath }
  })

  // 列出设备端 .pcap，并附带后台进程是否仍在运行（重启恢复用）
  ipcMain.handle(NETCAP_LIST, async (_e, { serial, deviceDir, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const dir = dirOf(deviceDir)
    const base = baseOf(dir)
    const root = await effectiveRoot(serial, deviceDir, asRoot)
    const lsArgv = root
      ? ['-s', serial, 'shell', ...suWrap('ls -l ' + sq(base) + '/*.pcap')]
      : ['-s', serial, 'shell', 'ls', '-l', base + '/*.pcap']
    const r = await run('adb.exe', lsArgv)
    const items = []
    if (r.code === 0) {
      for (const ln of r.out.split(/\r?\n/)) {
        const f = ln.trim().split(/\s+/)
        if (f.length < 8) continue
        const full = f[f.length - 1]
        if (!full.endsWith('.pcap')) continue
        items.push({ name: path.basename(full), size: f[4], mtime: f[5] + ' ' + f[6], path: full })
      }
    }
    const info = await runningInfo(serial, deviceDir, root)
    return { items, running: info.running, pid: info.pid, root }
  })

  // 删除设备端某个 pcap（连同其 PID / 错误文件）；root 文件普通 rm 失败时补一次 su
  ipcMain.handle(NETCAP_RM, async (_e, { serial, devicePath, asRoot }) => {
    if (!serial || !devicePath) throw new Error('serial / devicePath 必填')
    const p = safeDevicePath(devicePath)
    const files = `rm -f ${sq(p)} ${sq(p + '.pid')} ${sq(p + '.err')}`
    let r = await run('adb.exe', asRoot ? ['-s', serial, 'shell', ...suWrap(files)] : ['-s', serial, 'shell', 'rm', '-f', p, p + '.pid', p + '.err'])
    if (r.code !== 0 && !asRoot) r = await run('adb.exe', ['-s', serial, 'shell', ...suWrap(files)]).catch(() => ({ code: -1, err: 'su 不可用' }))
    if (r.code !== 0) throw new Error('删除失败：' + (r.err || r.code))
    return { ok: true }
  })
}
