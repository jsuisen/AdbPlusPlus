// 顶部标题栏「设备时钟」：与当前已连接且选中的设备内部时间保持同步。
//
// 设计要点：
// 0) 激活门控：启动后默认「灰点 + -- --:--:--」，不启动任何定时器、不发任何 adb 命令。
//    只有用户点击一次时钟才激活并开始走时；激活前 watch/focus/挂载全部不触发校准。
//    激活状态只存内存，重启应用复位，每次启动都要重新点一次。
// 1) 不能每秒发一次 adb 命令（子进程开销大、日志流采集时互相干扰），也不累加计数
//    （Chromium 后台会节流 setInterval，计数会越走越慢）。这里记录「校准时刻的设备挂钟」
//    与「校准时刻的本机时间戳」，每秒用 Date.now() 的**经过时间**推进显示，天然抗节流。
// 2) 每 10 秒向设备重新校准一次；设备切换、窗口重新聚焦、用户点击时钟时立即校准。
//    所以设备时间被手动改过、设备换了时区，最多 10 秒内就会跟上。
// 3) 用「伪 UTC 时间戳」承载设备挂钟：Date.UTC(设备年月日时分秒) 后再一律用
//    getUTC* 读取。这样跨天/跨月/跨年由 Date 自己进位，也完全不依赖本机时区。
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { api, deviceClockActive, deviceClockOk, deviceClockSerial, deviceClockText, devices, selectedSerial } from './state'

const PLACEHOLDER = '-- --:--:--'
const CALIBRATE_MS = 10000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

let baseWallMs = 0     // 校准时刻：设备挂钟对应的伪 UTC 时间戳（0 = 未同步）
let baseHostMs = 0     // 校准时刻：本机 Date.now()
let tickTimer = null
let calibrateTimer = null
let calibrating = false

const pad2 = (n) => String(n).padStart(2, '0')

// 解析 date 输出，返回 { y, mo, d, h, mi, s }。
// 主格式（toybox/gnu date）：+%Y-%m-%d_%H:%M:%S -> 2026-11-15_17:12:35
// 用下划线代替空格，避免 adb shell 把格式串按空格拆成两个参数导致只输出前半段。
// 老设备 toolbox date 不支持 +FORMAT，回退解析默认输出：
//   "Sun Nov 15 17:10:21 +08 2026" 或 "2026-11-15 17:10:21"
function parseDateOut(raw) {
  const s = String(raw || '').trim().split('\n')[0].trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})_(\d{1,2}):(\d{2}):(\d{2})$/.exec(s)
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/.exec(s)
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +m[6] }
  // 注意时区段可能含数字（+08 / GMT+08:00），中间必须用 .*? 而非 \D+
  m = /^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2}).*?(\d{4})\s*$/.exec(s)
  if (m) {
    const mo = MONTHS.indexOf(m[1]) + 1
    if (mo > 0) return { y: +m[6], mo, d: +m[2], h: +m[3], mi: +m[4], s: +m[5] }
  }
  return null
}

function render() {
  if (!baseWallMs) { deviceClockText.value = PLACEHOLDER; return }
  const d = new Date(baseWallMs + (Date.now() - baseHostMs))
  deviceClockText.value = pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) + ' ' +
    pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds())
}

function invalidate() {
  baseWallMs = 0
  baseHostMs = 0
  deviceClockOk.value = false
  deviceClockSerial.value = ''
  render()
}

// 「当前连接并且选中的设备」：必须仍在设备列表里且状态为 device（排除 offline/unauthorized）
function connected(serial) {
  return !!serial && devices.value.some(d => d.serial === serial && d.status === 'device')
}

async function calibrate() {
  const serial = selectedSerial.value
  if (!connected(serial)) { invalidate(); return }
  if (calibrating) return
  calibrating = true
  try {
    // 复用既有 adb:run 通用通道，无需改 main/ 与通道白名单
    let parsed = null
    const r = await api.invoke('adb:run', ['-s', serial, 'shell', 'date', '+%Y-%m-%d_%H:%M:%S'])
    if (r.code === 0) parsed = parseDateOut(r.out)
    if (!parsed) {
      const r2 = await api.invoke('adb:run', ['-s', serial, 'shell', 'date'])
      if (r2.code === 0) parsed = parseDateOut(r2.out)
    }
    // 校准途中用户切了设备 / 设备断开，丢弃这次结果，避免显示错设备的时间
    if (serial !== selectedSerial.value || !connected(serial)) { invalidate(); return }
    if (!parsed) { invalidate(); return }
    const host = Date.now()
    baseWallMs = Date.UTC(parsed.y, parsed.mo - 1, parsed.d, parsed.h, parsed.mi, parsed.s)
    baseHostMs = host
    deviceClockSerial.value = serial
    deviceClockOk.value = true
    render()
  } catch {
    if (serial === selectedSerial.value) invalidate()
  } finally {
    calibrating = false
  }
}

// 启动走时与周期校准。只在「首次点击激活」时调用；重复调用不会叠加定时器。
function startTimers() {
  if (!tickTimer) tickTimer = setInterval(render, 1000)
  if (!calibrateTimer) calibrateTimer = setInterval(calibrate, CALIBRATE_MS)
  window.removeEventListener('focus', calibrate)   // 防重复注册
  window.addEventListener('focus', calibrate)
}

// 首次点击 = 激活并开始计时；激活后每次点击 = 立即校准一次。
function refreshDeviceClock() {
  if (deviceClockActive.value) { calibrate(); return }
  deviceClockActive.value = true
  startTimers()
  calibrate()
}

export function useDeviceClock() {
  // 未激活时设备切换不做任何事，保持灰点 + 占位、不记时
  watch(selectedSerial, () => {
    if (!deviceClockActive.value) return
    invalidate()
    calibrate()
  })
  onMounted(() => {
    if (!deviceClockActive.value) { invalidate(); return }  // 只把显示钉在占位，不启动任何计时器
    // 根组件重挂载（HMR）时恢复已激活会话的定时器，避免时钟停在旧值
    startTimers()
    render()
  })
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer)
    if (calibrateTimer) clearInterval(calibrateTimer)
    window.removeEventListener('focus', calibrate)
    tickTimer = null
    calibrateTimer = null
  })
  return { refreshDeviceClock }
}
export { refreshDeviceClock, parseDateOut }
