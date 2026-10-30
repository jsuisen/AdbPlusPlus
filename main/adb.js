// adb 通用能力：设备列表、版本、任意 adb 子命令（参数数组）。
import path from 'node:path'
import { ADB_DEVICES, ADB_VERSION, ADB_PS, ADB_RUN, ADB_APP_START, ADB_APP_STOP, ADB_APP_RESTART, ADB_APP_CLEAR, ADB_APP_CLEAR_RESTART, ADB_APP_UNINSTALL, ADB_INPUT_TEXT, ADB_INPUT_KEY, ADB_INPUT_TAP, ADB_INPUT_SWIPE, ADB_INSTALL, ADB_CLEAR_DEVICE_CACHE, ADB_DISCONNECT, ADB_AM_START, ADB_START_SERVICE, ADB_STOP_SERVICE, ADB_BROADCAST, ADB_GRANT, ADB_REVOKE, ADB_PUSH, ADB_PULL, ADB_REBOOT, ADB_ROOT, ADB_UNROOT, ADB_REMOUNT, ADB_MONKEY, ADB_DUMPSYS, ADB_DEVICE_INFO, ADB_SERVICES, ADB_ACTIVITIES, ADB_GETPROP, ADB_PS_ALL, ADB_THREADS, ADB_PS_STAT, ADB_THREAD_STAT, ADB_BUGREPORT } from '../shared/ipc-channels.js'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ipcMain } from 'electron'
import { run } from './tools.js'

// 资源占用采集脚本（静态文件，运行时读取后整体作为 `adb shell` 的脚本参数下发；不含任何来自渲染进程的用户输入，无命令注入风险）
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROC_STAT_SCRIPT = fs.readFileSync(path.join(__dirname, 'device-scripts/proc_stat.sh'), 'utf8').trim()
const THREAD_STAT_SCRIPT = fs.readFileSync(path.join(__dirname, 'device-scripts/thread_stat.sh'), 'utf8').trim()

// am 命令 Extra 类型 -> 参数前缀（es 字符串 / ei 整数 / ez 布尔 / ef 浮点 / el 长整）
const EXTRA_FLAG = { es: '--es', ei: '--ei', ez: '--ez', ef: '--ef', el: '--el' }
// 设备相关命令统一前缀 -s serial（多设备定向，绝不拼 shell）
const devArgs = (serial, rest) => ['-s', serial, ...rest]

// /proc/meminfo 字段（kB）转友好容量
const memField = (txt, key) => {
  const m = new RegExp(key + ':\\s*(\\d+)\\s*kB').exec(txt)
  if (!m) return '—'
  const kb = Number(m[1])
  if (kb >= 1024 * 1024) return (kb / 1024 / 1024).toFixed(1) + ' GB'
  if (kb >= 1024) return (kb / 1024).toFixed(0) + ' MB'
  return kb + ' kB'
}
// df 单行（1K 块，无单位）解析 可用/总量
const dfParse = (line) => {
  const f = line.trim().split(/\s+/)
  if (f.length < 4) return '—'
  const toGb = (s) => {
    const m = /^([\d.]+)([GMK]?)/.exec(s)
    if (!m) return '—'
    let n = parseFloat(m[1]); const u = m[2] || 'K'
    if (u === 'G') n = n
    else if (u === 'M') n = n / 1024
    else n = n / 1024 / 1024
    return n.toFixed(1) + ' GB'
  }
  return toGb(f[3]) + ' / ' + toGb(f[1])
}
// dumpsys activity services 输出中提取 ServiceRecord 的 包名/类名（去重，不限制数量）
const parseServices = (txt) => {
  const set = new Set()
  for (const ln of txt.split(/\r?\n/)) {
    if (!ln.includes('ServiceRecord')) continue
    const m = /(\b[\w.]+)\/(\.?\w[\w$]*)/.exec(ln)
    if (m) set.add(m[1] + '/' + m[2])
  }
  return [...set]
}
// dumpsys activity activities / top 输出中提取前台 Activity（pkg/.Activity），去重。
// 不依赖 ActivityRecord 字面量：扫描整段文本提取所有 pkg/.Activity，兼容不同 Android 版本/厂商格式；
// 从前台标记行（mResumedActivity / ResumedActivity / mFocusedActivity / mFocusedApp / mCurrentFocus）识别真正前台项。
// 真实组件包名必含点，过滤掉 id/action_mode_bar_stub 之类的视图资源 id 误匹配。
const parseActivities = (txt) => {
  const rePkg = /([a-zA-Z0-9_.]+)\/(\.[a-zA-Z0-9_.]+|[a-zA-Z0-9_.]+)/g
  const isComp = (pkg) => pkg.includes('.') && pkg !== 'id' && pkg !== 'android'
  let resumed = ''
  for (const ln of txt.split(/\r?\n/)) {
    if (/mResumedActivity|ResumedActivity|mFocusedActivity|mFocusedApp|mCurrentFocus/.test(ln)) {
      rePkg.lastIndex = 0
      const m = rePkg.exec(ln)
      if (m && isComp(m[1])) { resumed = m[1] + '/' + m[2]; break }
    }
  }
  const set = new Set()
  for (const ln of txt.split(/\r?\n/)) {
    let mm
    rePkg.lastIndex = 0
    while ((mm = rePkg.exec(ln))) if (isComp(mm[1])) set.add(mm[1] + '/' + mm[2])
  }
  const list = [...set]
  list.sort((a, b) => {
    if (a === resumed) return -1
    if (b === resumed) return 1
    return a.localeCompare(b)
  })
  return { resumed, list }
}
// ps -A 输出解析：USER PID ... NAME（跳过表头，取 USER/PID/NAME）
const parsePs = (txt) => {
  const list = []
  for (const ln of txt.split(/\r?\n/)) {
    if (!ln.trim() || /^\s*USER\b/.test(ln)) continue
    const f = ln.trim().split(/\s+/)
    if (f.length < 2) continue
    list.push({ user: f[0], pid: f[1], name: f[f.length - 1] })
  }
  return list
}
// ps -T -A 输出解析：USER PID TID PPID VSZ RSS WCHAN ADDR S CMD（取 USER/PID/TID/S/NAME）
const parseThreads = (txt) => {
  const list = []
  for (const ln of txt.split(/\r?\n/)) {
    if (!ln.trim() || /^\s*USER\b/.test(ln)) continue
    const f = ln.trim().split(/\s+/)
    if (f.length < 3) continue
    list.push({ user: f[0], pid: f[1], tid: f[2], state: f[8] || '', name: f[f.length - 1] })
  }
  return list
}

// /proc 资源采集脚本输出解析：首行 CPUS=N；余下每行 pid|comm|state|utime|stime|nth|vsz|rss|rb|wb|name
const parseProcStat = (txt, fallbackCpus = 1) => {
  const list = []
  let cpus = fallbackCpus
  for (const ln of txt.split(/\r?\n/)) {
    if (!ln.trim()) continue
    if (ln.startsWith('CPUS=')) { cpus = Number(ln.slice(5)) || cpus; continue }
    const f = ln.split('|')
    if (f.length < 11) continue
    list.push({
      pid: f[0], comm: f[1], state: f[2],
      utime: Number(f[3]) || 0, stime: Number(f[4]) || 0,
      threads: Number(f[5]) || 0, vsize: Number(f[6]) || 0, rss: Number(f[7]) || 0,
      ioRead: Number(f[8]) || 0, ioWrite: Number(f[9]) || 0, name: f[10] || f[1],
    })
  }
  return { cpus, list }
}
// 线程级 CPU 采集脚本输出解析：首行 CPUS=N；余下每行 pid|tid|comm|utime|stime；返回 { cpus, map: pid-tid -> {utime,stime} }
const parseThreadStat = (txt) => {
  let cpus = 1
  const map = {}
  for (const ln of txt.split(/\r?\n/)) {
    if (!ln.trim()) continue
    if (ln.startsWith('CPUS=')) { cpus = Number(ln.slice(5)) || cpus; continue }
    const f = ln.split('|')
    if (f.length < 5) continue
    map[f[0] + '-' + f[1]] = { utime: Number(f[3]) || 0, stime: Number(f[4]) || 0 }
  }
  return { cpus, map }
}

export async function listDevices() {
  const { out } = await run('adb.exe', ['devices', '-l'])
  const devs = []
  for (const ln of out.split(/\r?\n/).slice(1)) {
    const m = ln.match(/^(\S+)\s+(device|offline|unauthorized)\s*(.*)$/)
    if (m) devs.push({ serial: m[1], status: m[2], info: (m[3] || '').trim() })
  }
  return devs
}

export function registerAdbIpc() {
  ipcMain.handle(ADB_DEVICES, async () => listDevices())
  ipcMain.handle(ADB_VERSION, async () => run('adb.exe', ['version']))
  // 进程列表：用于日志窗口「进程包名」下拉；NAME 即进程名（应用即包名），格式 包名(进程号)
  ipcMain.handle(ADB_PS, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const { out, code } = await run('adb.exe', ['-s', serial, 'shell', 'ps'])
    if (code !== 0) return []
    const procs = []
    for (const ln of out.split(/\r?\n/)) {
      const f = ln.trim().split(/\s+/)
      if (f.length < 9 || f[0] === 'USER') continue
      const pid = f[1]
      const name = f[f.length - 1]
      if (!pid || !name) continue
      // 仅保留应用进程：进程名形如 Java 包名（含 '.' 且非路径），过滤 init/logd/surfaceflinger/zygote 等系统守护进程
      if (!name.includes('.') || name.startsWith('/')) continue
      procs.push({ pid, pkg: name })
    }
    return procs
  })
  // 通用命令：args 必须是字符串数组，主进程只转交，绝不拼 shell
  ipcMain.handle(ADB_RUN, async (_e, args) => {
    if (!Array.isArray(args) || !args.every((a) => typeof a === 'string')) {
      throw new Error('args 必须是字符串数组')
    }
    return run('adb.exe', args)
  })

  // ---- 应用生命周期（目标包由渲染进程传入，绝不拼 shell） ----
  ipcMain.handle(ADB_APP_START, async (_e, { serial, pkg }) => {
    if (!serial || !pkg) throw new Error('serial 与 pkg 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-p', pkg])
  })
  ipcMain.handle(ADB_APP_STOP, async (_e, { serial, pkg }) => {
    if (!serial || !pkg) throw new Error('serial 与 pkg 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'am', 'force-stop', pkg])
  })
  ipcMain.handle(ADB_APP_RESTART, async (_e, { serial, pkg }) => {
    if (!serial || !pkg) throw new Error('serial 与 pkg 必填')
    await run('adb.exe', ['-s', serial, 'shell', 'am', 'force-stop', pkg])
    await new Promise((r) => setTimeout(r, 300))
    return run('adb.exe', ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-p', pkg])
  })
  ipcMain.handle(ADB_APP_CLEAR, async (_e, {serial, pkg}) => {
    if (!serial || !pkg) throw new Error('serial 与 pkg 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'pm', 'clear', pkg])
  })
  ipcMain.handle(ADB_APP_CLEAR_RESTART, async (_e, { serial, pkg }) => {
    if (!serial || !pkg) throw new Error('serial 与 pkg 必填')
    await run('adb.exe', ['-s', serial, 'shell', 'pm', 'clear', pkg])
    await new Promise((r) => setTimeout(r, 300))
    return run('adb.exe', ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', '-p', pkg])
  })
  ipcMain.handle(ADB_APP_UNINSTALL, async (_e, { serial, pkg }) => {
    if (!serial || !pkg) throw new Error('serial 与 pkg 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'pm', 'uninstall', pkg])
  })

  // ---- 输入模拟 ----
  ipcMain.handle(ADB_INPUT_TEXT, async (_e, { serial, text }) => {
    if (!serial || !text) throw new Error('serial 与 text 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'input', 'text', text.replace(/ /g, '%s')])
  })
  ipcMain.handle(ADB_INPUT_KEY, async (_e, { serial, key }) => {
    if (!serial || !key) throw new Error('serial 与 key 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'input', 'keyevent', String(key)])
  })
  ipcMain.handle(ADB_INPUT_TAP, async (_e, { serial, x, y }) => {
    if (!serial || x == null || y == null) throw new Error('serial / x / y 必填')
    return run('adb.exe', ['-s', serial, 'shell', 'input', 'tap', String(x), String(y)])
  })
  ipcMain.handle(ADB_INPUT_SWIPE, async (_e, { serial, x1, y1, x2, y2, duration }) => {
    if (!serial || [x1, y1, x2, y2].some((v) => v == null)) throw new Error('serial 与坐标必填')
    const cmd = ['-s', serial, 'shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2)]
    // duration 为可选滑动时长（毫秒），adb input swipe 支持在坐标后追加该值
    if (duration != null) cmd.push(String(duration))
    return run('adb.exe', cmd)
  })

  // ---- 安装 / 设备缓存 ----
  ipcMain.handle(ADB_INSTALL, async (_e, { serial, apkPath }) => {
    if (!serial || !apkPath) throw new Error('serial 与 apkPath 必填')
    return run('adb.exe', ['-s', serial, 'install', '-r', apkPath])
  })
  ipcMain.handle(ADB_CLEAR_DEVICE_CACHE, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    return run('adb.exe', ['-s', serial, 'logcat', '-c'])
  })

  // 断开设备：前端已乐观地从视图移除该设备后再尽力调用本通道。
  // 网络设备（serial 含 ':'，如 192.168.1.10:5555）可经 adb disconnect 真正断开服务端连接；
  // USB 本地设备无法用该命令移除，移除仅作用于前端视图，主进程透传该 serial 执行（会返回 no such device）。
  ipcMain.handle(ADB_DISCONNECT, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    return run('adb.exe', ['disconnect', serial])
  })

  // ---- 组件调试（am start / startservice / stopservice / broadcast） ----
  // 启动 Activity：显式（-n 包名/类）或隐式（-a action），支持 Extra 与 -W 测耗时
  ipcMain.handle(ADB_AM_START, async (_e, { serial, pkg, activity, action, extras = [], wait = false }) => {
    if (!serial) throw new Error('serial 必填')
    const args = devArgs(serial, ['shell', 'am', 'start'])
    if (wait) args.push('-W')
    if (action && action.trim()) args.push('-a', action.trim())
    else if (pkg && activity) args.push('-n', `${pkg}/${activity}`)
    else throw new Error('需填 Action（隐式）或 包名+Activity（显式）')
    for (const e of extras) if (e && e.key) args.push(EXTRA_FLAG[e.type] || '--es', e.key, String(e.value))
    return run('adb.exe', args)
  })
  ipcMain.handle(ADB_START_SERVICE, async (_e, { serial, pkg, service, foreground = false, extras = [] }) => {
    if (!serial || !pkg || !service) throw new Error('serial / 包名 / Service 类名必填')
    const cmd = foreground ? 'start-foreground-service' : 'startservice'
    const args = devArgs(serial, ['shell', 'am', cmd, '-n', `${pkg}/${service}`])
    for (const e of extras) if (e && e.key) args.push(EXTRA_FLAG[e.type] || '--es', e.key, String(e.value))
    return run('adb.exe', args)
  })
  ipcMain.handle(ADB_STOP_SERVICE, async (_e, { serial, pkg, service }) => {
    if (!serial || !pkg || !service) throw new Error('serial / 包名 / Service 类名必填')
    return run('adb.exe', devArgs(serial, ['shell', 'am', 'stopservice', '-n', `${pkg}/${service}`]))
  })
  // 发送广播：必填 action，可选目标组件(-n)、Extra、Flags(-f)
  ipcMain.handle(ADB_BROADCAST, async (_e, { serial, action, component, extras = [], flags }) => {
    if (!serial || !action) throw new Error('serial 与 action 必填')
    const args = devArgs(serial, ['shell', 'am', 'broadcast', '-a', action])
    if (component && component.trim()) args.push('-n', component.trim())
    for (const e of extras) if (e && e.key) args.push(EXTRA_FLAG[e.type] || '--es', e.key, String(e.value))
    if (flags && flags.trim()) args.push('-f', flags.trim())
    return run('adb.exe', args)
  })

  // ---- 权限管理（pm grant / revoke） ----
  ipcMain.handle(ADB_GRANT, async (_e, { serial, pkg, perm }) => {
    if (!serial || !pkg || !perm) throw new Error('serial / 包名 / 权限必填')
    return run('adb.exe', devArgs(serial, ['shell', 'pm', 'grant', pkg, perm]))
  })
  ipcMain.handle(ADB_REVOKE, async (_e, { serial, pkg, perm }) => {
    if (!serial || !pkg || !perm) throw new Error('serial / 包名 / 权限必填')
    return run('adb.exe', devArgs(serial, ['shell', 'pm', 'revoke', pkg, perm]))
  })

  // ---- 文件传输（push / pull） ----
  ipcMain.handle(ADB_PUSH, async (_e, { serial, local, remote }) => {
    if (!serial || !local || !remote) throw new Error('serial / 本地路径 / 设备路径必填')
    return run('adb.exe', devArgs(serial, ['push', local, remote]))
  })
  ipcMain.handle(ADB_PULL, async (_e, { serial, remote, local }) => {
    if (!serial || !remote || !local) throw new Error('serial / 设备路径 / 本地路径必填')
    return run('adb.exe', devArgs(serial, ['pull', remote, local]))
  })

  // ---- 设备控制（reboot / root / unroot / remount） ----
  ipcMain.handle(ADB_REBOOT, async (_e, { serial, mode }) => {
    if (!serial) throw new Error('serial 必填')
    const args = devArgs(serial, ['reboot'])
    if (mode && mode.trim()) args.push(mode.trim())
    return run('adb.exe', args)
  })
  ipcMain.handle(ADB_ROOT, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    return run('adb.exe', devArgs(serial, ['root']))
  })
  ipcMain.handle(ADB_UNROOT, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    return run('adb.exe', devArgs(serial, ['unroot']))
  })
  ipcMain.handle(ADB_REMOUNT, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    return run('adb.exe', devArgs(serial, ['remount']))
  })

  // ---- Monkey 压力测试 ----
  ipcMain.handle(ADB_MONKEY, async (_e, { serial, pkg, seed, throttle, count }) => {
    if (!serial || !pkg) throw new Error('serial 与 包名必填')
    const args = devArgs(serial, ['shell', 'monkey', '-p', pkg, '-v', '-v', '-v'])
    if (seed != null && seed !== '') args.push('-s', String(seed))
    if (throttle != null && throttle !== '') args.push('--throttle', String(throttle))
    args.push(String(count != null && count !== '' ? count : 1000))
    return run('adb.exe', args)
  })

  // ---- dumpsys 任意 service（设备信息页自由查询） ----
  ipcMain.handle(ADB_DUMPSYS, async (_e, { serial, service }) => {
    if (!serial || !service) throw new Error('serial 与 service 必填')
    return run('adb.exe', devArgs(serial, ['shell', 'dumpsys', service]))
  })

  // getprop 输出 [key]: [value] 解析为 map；pickProp 先按候选键精确取值，再按 grep 谓词匹配第一个键
  const getpropMap = (txt) => {
    const m = {}
    for (const ln of txt.split(/\r?\n/)) {
      const x = /\[([^\]]+)\]:\s*\[(.*)\]/.exec(ln)
      if (x) m[x[1]] = x[2]
    }
    return m
  }
  const pickProp = (map, keys, grepFn) => {
    for (const k of keys) if (map[k] != null && String(map[k]).trim() !== '') return String(map[k]).trim()
    if (grepFn) for (const k of Object.keys(map)) if (grepFn(k) && String(map[k]).trim() !== '') return String(map[k]).trim()
    return ''
  }

  // ---- 设备信息聚合（型号/版本/分辨率/密度/内存/存储/CPU/前台Activity/运行Service/MAC/android_id/stbid/oid） ----
  ipcMain.handle(ADB_DEVICE_INFO, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const one = async (args) => {
      try { const r = await run('adb.exe', devArgs(serial, args)); return r.code === 0 ? r.out : '' } catch { return '' }
    }
    const out = {}
    const model = await one(['shell', 'getprop', 'ro.product.model'])
    out.model = model.trim() || '—'
    const av = await one(['shell', 'getprop', 'ro.build.version.release'])
    out.androidVersion = av.trim() || '—'
    const size = await one(['shell', 'wm', 'size'])
    const m = /(\d+x\d+)/.exec(size); out.resolution = m ? m[1] : '—'
    const dens = await one(['shell', 'wm', 'density'])
    const md = /(\d+)/.exec(dens); out.density = md ? md[1] + ' dpi' : '—'
    const mem = await one(['shell', 'cat', '/proc/meminfo'])
    out.memTotal = memField(mem, 'MemTotal')
    out.memAvailable = memField(mem, 'MemAvailable') || memField(mem, 'MemFree')
    const cpu = await one(['shell', 'cat', '/proc/cpuinfo'])
    const cores = (cpu.match(/processor\s*:/g) || []).length
    out.cpu = cores ? cores + ' 核' : '—'
    const df = await one(['shell', 'df'])
    const dataLine = df.split(/\r?\n/).find((l) => /\/data(\s|$)/.test(l)) || df.split(/\r?\n/).find((l) => /\/storage/.test(l)) || ''
    out.storage = dfParse(dataLine)
    const fa = await one(['shell', 'dumpsys', 'window', '|', 'grep', 'mCurrentFocus'])
    const fm = /mCurrentFocus=([^\s}]+)/.exec(fa); out.foregroundActivity = fm ? fm[1] : '—'
    // 多网卡 MAC（/sys/class/net/<nic>/address）
    const macRaw = await one(['shell', 'for n in $(ls /sys/class/net); do a=$(cat /sys/class/net/$n/address 2>/dev/null); [ -n "$a" ] && echo "$n=$a"; done'])
    out.macs = macRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    // android_id
    const aid = await one(['shell', 'settings', 'get', 'secure', 'android_id'])
    out.androidId = aid.trim() || '—'
    // stbid / oid：厂商定制属性，getprop 中启发式抓取（找不到返回 —）
    const gp = await one(['shell', 'getprop'])
    const gmap = getpropMap(gp)
    out.stbId = pickProp(gmap, ['persist.sys.stbid', 'ro.stb.stbid', 'ro.stbid', 'vendor.stb.stbid', 'stb.stbid'], (k) => /stbid/i.test(k)) || '—'
    out.oid = pickProp(gmap, ['persist.sys.oid', 'ro.stb.oid', 'ro.operator.oid', 'vendor.oid', 'operator.oid', 'oid'], (k) => /oid/i.test(k) && !/android|build/i.test(k)) || '—'
    return out
  })

  // ---- 运行中的 Service（独立 tab，不限数量） ----
  ipcMain.handle(ADB_SERVICES, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', 'dumpsys', 'activity', 'services']))
    return { code: r.code, list: parseServices(r.out) }
  })

  // ---- 前台 Activity（独立 tab，从 dumpsys activity activities 提取；为空则回退 dumpsys activity top） ----
  ipcMain.handle(ADB_ACTIVITIES, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', 'dumpsys', 'activity', 'activities']))
    let parsed = parseActivities(r.out)
    if (r.code === 0 && parsed.list.length === 0) {
      const r2 = await run('adb.exe', devArgs(serial, ['shell', 'dumpsys', 'activity', 'top']))
      if (r2.code === 0) { const p2 = parseActivities(r2.out); if (p2.list.length) parsed = p2 }
    }
    return { code: r.code, ...parsed }
  })

  // ---- 系统属性 getprop（独立 tab，[key]: [value] 解析为列表） ----
  ipcMain.handle(ADB_GETPROP, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', 'getprop']))
    const list = []
    if (r.code === 0) {
      for (const ln of r.out.split(/\r?\n/)) {
        const m = /\[([^\]]+)\]:\s*\[(.*)\]/.exec(ln)
        if (m) list.push({ key: m[1], value: m[2] })
      }
    }
    return { code: r.code, list }
  })

  // ---- 当前系统运行的进程（ps，全量，不限 App） ----
  ipcMain.handle(ADB_PS_ALL, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', 'ps', '-A']))
    return { code: r.code, list: parsePs(r.out) }
  })

  // ---- 当前系统运行的线程（ps -T -A，含 TID） ----
  ipcMain.handle(ADB_THREADS, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', 'ps', '-T', '-A']))
    return { code: r.code, list: parseThreads(r.out) }
  })

  // ---- 进程资源占用：CPU(累计 jiffies) / 内存(RSS 页、VSZ 字节) / 线程数 / 磁盘IO(累计字节) ----
  // 返回 { code, cpus, list: [{pid,comm,state,utime,stime,threads,vsize,rss,ioRead,ioWrite,name}] }
  // CPU% 由前端用两次采样的 utime+stime 差值计算（需周期刷新）
  ipcMain.handle(ADB_PS_STAT, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', PROC_STAT_SCRIPT]))
    return { code: r.code, ...parseProcStat(r.out, 1) }
  })

  // ---- 线程级 CPU（每 tid 的 utime+stime 累计 jiffies），与 adb:threads 结果按 pid-tid 合并算 CPU% ----
  ipcMain.handle(ADB_THREAD_STAT, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const r = await run('adb.exe', devArgs(serial, ['shell', THREAD_STAT_SCRIPT]))
    const { cpus, map } = parseThreadStat(r.out)
    return { code: r.code, cpus, list: map }
  })

  // ---- bugreport（聚合诊断报告，落盘到指定目录） ----
  ipcMain.handle(ADB_BUGREPORT, async (_e, { serial, outDir }) => {
    if (!serial || !outDir) throw new Error('serial 与 保存目录必填')
    const target = path.join(outDir, 'bugreport.zip')
    const r = await run('adb.exe', devArgs(serial, ['bugreport', target]))
    return { ...r, path: target }
  })
}
