// 网络抓包：设备端 tcpdump 常驻运行，停止时 pkill -INT 刷盘退出；按需 pull 到本机。
// 流程照搬 media.js（录屏）：spawn 常驻子进程，stop 时杀本地进程 + 设备端 pkill + 等待落盘。
// 全部参数数组 spawn，不拼 shell（防命令注入）。多设备按 serial 分桶（同 logcat）。
import { ipcMain } from 'electron'
import { NETCAP_START, NETCAP_ERROR, NETCAP_STOPPED, NETCAP_STARTED, NETCAP_STOP, NETCAP_PULL, NETCAP_LIST, NETCAP_RM } from '../shared/ipc-channels.js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { run, resolveTool } from './tools.js'

const FLUSH_WAIT = 800        // 停止后等待设备端 tcpdump 刷盘（与 media:recordStop 一致）
const sessions = new Map()    // serial -> { serial, child, devicePath }
let winRef = null

const pad2 = (n) => String(n).padStart(2, '0')
const ymdhms = (d) => '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds())
// serial 可能含 ':'（网络地址）或 '/'，sanitize 避免非法路径字符
const sanitize = (s) => (s || '').replace(/[^a-z0-9._-]/gi, '_')

// 把用户配置的 tcpdump 参数解析为数组，并强制以生成的 devicePath 作为 -w 的值
// （用户若在参数里写了 -w xxx，其后的路径值被丢弃，保证文件名规则可控）
function buildTcpdumpCmd(tcpdumpPath, args, devicePath) {
  const toks = (args && args.trim()) ? args.trim().split(/\s+/).filter(Boolean) : []
  const out = []
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '-w') { i++; continue } // 跳过 -w 及其紧跟的值（若有）
    out.push(toks[i])
  }
  return [tcpdumpPath, ...out, '-w', devicePath]
}

// 单引号包裹（防路径含空格/特殊字符在 su -c 内被拆词）
const sq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'"

// 以 root 运行某条设备内命令：cmdStr 为完整命令串（调用方已对路径单引号包裹）。
// 返回 ['su','-c','"cmdStr"']：外层双引号保证设备端 `su -c` 取到完整命令串
// （adb shell 把参数用空格拼接、不自动加引号；若不包双引号，`su -c` 只能拿到第一个词，后半段丢失）。
function suWrap(cmdStr) { return ['su', '-c', '"' + cmdStr + '"'] }

// 以 root 运行时的 tcpdump 命令串：仅给 tcpdump 提权，参数里用户写的 -w 被丢弃、强制用 devicePath（路径单引号包裹）
function tcpdumpCmdStr(args, devicePath) {
  const toks = (args && args.trim()) ? args.trim().split(/\s+/).filter(Boolean) : []
  const out = []
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] === '-w') { i++; continue }
    out.push(toks[i])
  }
  return 'tcpdump ' + out.join(' ') + ' -w ' + sq(devicePath)
}

// 设备友好标签（机型_序列号），与渲染层 deviceLabel 规则对齐
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

export function registerNetcapIpc(win) {
  winRef = win

  // 开始抓包：校验 tcpdump 命令可用 → 建目录 → 生成随机文件名 → spawn
  // asRoot=true 时整条链路以 su -c 提权（仅 tcpdump 进程拿 root，不重启 adbd），用于无 root 的 adbd 设备
  ipcMain.handle(NETCAP_START, async (_e, { serial, deviceDir, args, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const dir = (deviceDir && deviceDir.trim()) || '/sdcard/adbpp_captures/'
    // 先停同设备的旧会话（避免重复抓包）
    if (sessions.has(serial)) {
      const old = sessions.get(serial)
      if (old.child) { try { old.child.kill('SIGINT') } catch {} }
      sessions.delete(serial)
    }
    // 建目录：root 模式在设备端以 root 建，保证 tcpdump 可写
    const mkdirArgv = asRoot ? suWrap('mkdir -p ' + sq(dir)) : ['mkdir', '-p', dir]
    await run('adb.exe', ['-s', serial, 'shell', ...mkdirArgv])
    // 前置校验：tcpdump 必须在设备 PATH 中可用（不同设备二进制路径不可预测，故直接调 tcpdump 命令）
    // root 模式用 su -c 校验，避免 root 专属 PATH 漏检
    const chkArgv = asRoot ? suWrap('command -v tcpdump') : ['command', '-v', 'tcpdump']
    const chk = await run('adb.exe', ['-s', serial, 'shell', ...chkArgv])
    if (chk.code !== 0 || !chk.out.trim()) throw new Error('设备未找到 tcpdump 命令，请先预装/推送后再抓包')
    const label = await deviceLabel(serial)
    const ts = ymdhms(new Date())
    const rand = Math.random().toString(16).slice(2, 6)
    const name = label + '_' + ts + '_' + rand + '.pcap'
    const devicePath = dir.replace(/\/$/, '') + '/' + name
    // 设备内要执行的 tcpdump 命令：非 root 直接展开为数组；root 用 su -c 包裹整条命令串（路径已单引号包裹）
    const tcpdumpArgv = asRoot ? suWrap(tcpdumpCmdStr(args, devicePath)) : buildTcpdumpCmd('tcpdump', args, devicePath)
    const child = spawn(resolveTool('adb.exe'), ['-s', serial, 'shell', ...tcpdumpArgv], { windowsHide: true })
    const session = { serial, child, devicePath, stderrBuf: '', asRoot: !!asRoot }
    sessions.set(serial, session)
    // tcpdump -vv 会把每个包的解析打到 stderr，属正常输出，不实时转发；仅在进程异常退出时上报
    child.stderr.on('data', (d) => { session.stderrBuf += d.toString() })
    child.on('error', (e) => {
      if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_ERROR, { serial, text: String(e) })
    })
    // 异常退出（被外部杀 / 崩溃 / 权限不足）：非零码则把 stderr 作为错误提示，否则按正常停止处理
    child.on('exit', (code) => {
      if (sessions.get(serial) !== session) return   // 已被 netcap:stop 清理，不重复通知
      sessions.delete(serial)
      if (code !== 0 && session.stderrBuf) {
        if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_ERROR, { serial, text: session.stderrBuf.slice(0, 500) })
      } else {
        if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_STOPPED, { serial, devicePath })
      }
    })
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_STARTED, { serial, devicePath })
    return { devicePath, label, ts }
  })

  // 停止抓包：杀本地进程 + 设备端 pkill -INT 刷盘 + 等待；设备端文件保留，回发设备路径
  // root 模式下 tcpdump 是 root 进程，普通 pkill 无权限杀，需经 su -c 提权
  ipcMain.handle(NETCAP_STOP, async (_e, serial) => {
    const s = serial ? sessions.get(serial) : null
    if (!s) return { devicePath: null }
    sessions.delete(serial)
    if (s.child) { try { s.child.kill('SIGINT') } catch {} }
    const pkillArgv = s.asRoot ? suWrap('pkill -INT tcpdump') : ['pkill', '-INT', 'tcpdump']
    await run('adb.exe', ['-s', serial, 'shell', ...pkillArgv]).catch(() => {})
    await new Promise((r) => setTimeout(r, FLUSH_WAIT))
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(NETCAP_STOPPED, { serial, devicePath: s.devicePath })
    return { devicePath: s.devicePath }
  })

  // 按需下载（pull）到本机：设备端文件保留，本机多一份副本
  // root 模式文件可能归 root 所有，先 chmod 644 保证 adb pull 可读
  ipcMain.handle(NETCAP_PULL, async (_e, { serial, devicePath, localDir, asRoot }) => {
    if (!serial || !devicePath || !localDir) throw new Error('serial / devicePath / localDir 必填')
    if (asRoot) await run('adb.exe', ['-s', serial, 'shell', ...suWrap('chmod 644 ' + sq(devicePath))]).catch(() => {})
    fs.mkdirSync(localDir, { recursive: true })
    const localPath = path.join(localDir, path.basename(devicePath))
    const r = await run('adb.exe', ['-s', serial, 'pull', devicePath, localPath])
    if (r.code !== 0) throw new Error('pull 失败：' + (r.err || r.code))
    return { localPath }
  })

  // 列出设备端某目录下全部 .pcap（名称/大小/时间/完整路径），供「抓包管理」列表展示
  // root 模式文件可能归 root 所有，ls 需经 su -c
  ipcMain.handle(NETCAP_LIST, async (_e, { serial, deviceDir, asRoot }) => {
    if (!serial) throw new Error('serial 必填')
    const dir = (deviceDir && deviceDir.trim()) || '/sdcard/adbpp_captures/'
    const base = dir.replace(/\/$/, '')
    // root 模式文件可能归 root 所有，ls 经 su -c；仅目录单引号包裹，保留 /*.pcap 通配（不包进单引号才能展开）
    const lsArgv = asRoot ? suWrap('ls -l ' + sq(base) + '/*.pcap') : ['ls', '-l', base + '/*.pcap']
    const r = await run('adb.exe', ['-s', serial, 'shell', ...lsArgv])
    if (r.code !== 0) return { items: [] }
    const items = []
    for (const ln of r.out.split(/\r?\n/)) {
      const f = ln.trim().split(/\s+/)
      if (f.length < 8) continue
      const full = f[f.length - 1]   // ls -l 输出的末字段已是完整设备路径（glob 展开为绝对路径）
      if (!full.endsWith('.pcap')) continue
      const size = f[4]
      const mtime = f[5] + ' ' + f[6]
      items.push({ name: path.basename(full), size, mtime, path: full })
    }
    return { items }
  })

  // 删除设备端某个 pcap
  // root 模式文件可能归 root 所有，rm 需经 su -c
  ipcMain.handle(NETCAP_RM, async (_e, { serial, devicePath, asRoot }) => {
    if (!serial || !devicePath) throw new Error('serial / devicePath 必填')
    const rmArgv = asRoot ? suWrap('rm -f ' + sq(devicePath)) : ['rm', '-f', devicePath]
    const r = await run('adb.exe', ['-s', serial, 'shell', ...rmArgv])
    if (r.code !== 0) throw new Error('删除失败：' + (r.err || r.code))
    return { ok: true }
  })
}
