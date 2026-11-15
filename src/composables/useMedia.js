// 由 split_app2.cjs 自动拆分生成（media）；网络抓包事件处理器也归本域（netcap 事件的消费方是抓包状态）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {api, captureList, captureOpen, capturing, cfg, lastMsg, recording, screenshotting, selectedSerial, showResult, ymdhms} from './state'
import { sanitizeSerial } from './shared'
import { toast } from './useUi'

// 网络抓包事件（useApp 订阅）：started 是「进行中」状态，只写状态栏提示，不弹结果窗；
// stopped 后刷新设备端文件列表。
function onNetcapStarted(p) { if (p && p.serial) { capturing[p.serial] = true; lastMsg.value = '抓包已开始：' + p.serial } }

function onNetcapStopped(p) { if (p && p.serial) { capturing[p.serial] = false; if (captureOpen.value) refreshCaptures() } }

function onNetcapError(p) { if (p && p.serial) toast('抓包错误：' + (p.text || '')) }

async function takeScreenshot() {
  if (!selectedSerial.value) { showResult('截图', '未选择设备，请先在侧边栏选择设备', false); return }
  const outPath = await api.invoke('file:pickSave', {
    defaultPath: (cfg.value.outDir || '') + '/screenshot.png',
    filters: [{ name: 'PNG', extensions: ['png'] }]
  })
  if (!outPath) return
  try {
    const p = await api.invoke('media:screenshot', { serial: selectedSerial.value, outPath })
    showResult('截图', '截图已保存：' + p, true)
  } catch (e) { showResult('截图', '截图失败：' + e.message, false) }
}

async function startRec() {
  if (!selectedSerial.value) { showResult('录屏', '未选择设备，请先在侧边栏选择设备', false); return }
  try {
    await api.invoke('media:recordStart', { serial: selectedSerial.value })
    recording.value = true
    // 「录屏中」是进行中的状态、不是结果：保留在状态栏，不弹窗
    lastMsg.value = '录屏中…（设备端单段 ≤3 分钟，停止后自动 pull 到本机）'
  } catch (e) { showResult('录屏', '录屏启动失败：' + e.message, false) }
}

async function stopRec() {
  const outPath = await api.invoke('file:pickSave', {
    defaultPath: (cfg.value.outDir || '') + '/screenrecord.mp4',
    filters: [{ name: 'MP4', extensions: ['mp4'] }]
  })
  if (!outPath) return
  try {
    const p = await api.invoke('media:recordStop', { outPath })
    recording.value = false
    lastMsg.value = ''
    showResult('录屏', '录屏已保存：' + p, true)
  } catch (e) { showResult('录屏', '录屏停止失败：' + e.message, false) }
}

function shotName() {
  const d = new Date()
  return 'screenshot_' + ymdhms(d) + '_' + sanitizeSerial(selectedSerial.value) + '.png'
}

// quiet=true 用于「连续截图」定时流：逐张弹窗会每秒抢占焦点，只刷新状态栏进行中提示。
async function doScreenshotToDir(dir, quiet = false) {
  if (!selectedSerial.value) {
    showResult('截图', '未选择设备，请先在侧边栏选择设备', false, { dedupe: 'screenshotNoDevice' })
    return false
  }
  const name = shotName()
  try {
    const p = await api.invoke('media:screenshotToDir', { serial: selectedSerial.value, dir, name })
    if (quiet) lastMsg.value = '连续截图：已保存 ' + p
    else showResult('截图', '截图已保存：' + p, true)
    return true
  } catch (e) {
    if (quiet) lastMsg.value = '连续截图失败：' + e.message
    else showResult('截图', '截图失败：' + e.message, false)
    return false
  }
}

async function screenshotToPath() {
  if (!selectedSerial.value) { showResult('截图', '未选择设备，请先在侧边栏选择设备', false); return }
  const dir = cfg.value.screenshotDir || cfg.value.outDir || '.'
  await doScreenshotToDir(dir)
}

function toggleScreenshotTimer() {
  if (screenshotting.value) {
    if (screenshotTimer) { clearInterval(screenshotTimer); screenshotTimer = null }
    screenshotting.value = false
    lastMsg.value = ''
    showResult('连续截图', '已停止连续截图', true)
    return
  }
  if (!selectedSerial.value) { showResult('连续截图', '未选择设备，请先在侧边栏选择设备', false); return }
  const dir = cfg.value.screenshotDir || cfg.value.outDir || '.'
  const interval = Math.max(200, Number(cfg.value.screenshotInterval) || 1000)
  screenshotting.value = true
  doScreenshotToDir(dir, true) // 立即先截一张
  screenshotTimer = setInterval(() => doScreenshotToDir(dir, true), interval)
  // 启动/进行中属于状态，保留在状态栏
  lastMsg.value = '连续截图已启动：每 ' + interval + 'ms 保存到 ' + dir
}

async function startCapture() {
  if (!selectedSerial.value) { toast('未选择设备'); return }
  try {
    await api.invoke('netcap:start', {
      serial: selectedSerial.value,
      deviceDir: cfg.value.captureDeviceDir,
      args: cfg.value.captureArgs,
      asRoot: cfg.value.captureAsRoot
    })
    capturing[selectedSerial.value] = true
    toast('抓包中…（停止后文件保留在设备端，可在「抓包管理」下载到本机）')
  } catch (e) { toast('开始抓包失败：' + e.message) }
}

async function stopCapture() {
  const s = selectedSerial.value
  if (!s) return
  try {
    await api.invoke('netcap:stop', s)
    capturing[s] = false
    toast('已停止抓包（文件保留在设备端）')
  } catch (e) { toast('停止抓包失败：' + e.message) }
}

function openCaptureManager() {
  if (!selectedSerial.value) { toast('未选择设备'); return }
  captureOpen.value = true
  refreshCaptures()
}

async function refreshCaptures() {
  if (!selectedSerial.value) return
  try {
    const r = await api.invoke('netcap:list', { serial: selectedSerial.value, deviceDir: cfg.value.captureDeviceDir, asRoot: cfg.value.captureAsRoot })
    captureList[selectedSerial.value] = r.items || []
  } catch (e) { toast('列出抓包失败：' + e.message) }
}

async function pullCapture(item) {
  if (!selectedSerial.value) return
  try {
    const localDir = cfg.value.captureLocalDir || (cfg.value.outDir + '/captures')
    const r = await api.invoke('netcap:pull', { serial: selectedSerial.value, devicePath: item.path, localDir, asRoot: cfg.value.captureAsRoot })
    toast('已下载：' + r.localPath)
  } catch (e) { toast('下载失败：' + e.message) }
}

async function deleteCapture(item) {
  if (!selectedSerial.value) return
  try {
    await api.invoke('netcap:rm', { serial: selectedSerial.value, devicePath: item.path, asRoot: cfg.value.captureAsRoot })
    await refreshCaptures()
  } catch (e) { toast('删除失败：' + e.message) }
}

async function copyCapturePath(item) {
  try { await api.invoke('clipboard:write', { text: item.path }); toast('已复制路径：' + item.path) } catch { toast('复制失败') }
}

let screenshotTimer = null
export function useMedia() {

  return { copyCapturePath, deleteCapture, doScreenshotToDir, onNetcapError, onNetcapStarted, onNetcapStopped, openCaptureManager, pullCapture, refreshCaptures, screenshotToPath, shotName, startCapture, startRec, stopCapture, stopRec, takeScreenshot, toggleScreenshotTimer }
}
export { copyCapturePath, deleteCapture, doScreenshotToDir, onNetcapError, onNetcapStarted, onNetcapStopped, openCaptureManager, pullCapture, refreshCaptures, screenshotToPath, shotName, startCapture, startRec, stopCapture, stopRec, takeScreenshot, toggleScreenshotTimer }