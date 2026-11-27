// 由 split_app2.cjs 自动拆分生成（media）；网络抓包事件处理器也归本域（netcap 事件的消费方是抓包状态）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t } from '@/i18n'
import {api, captureList, captureOpen, capturing, cfg, lastMsg, recording, screenshotting, selectedSerial, showResult, ymdhms} from './state'
import { sanitizeSerial } from './shared'
import { toast } from './useUi'

// 网络抓包事件（useApp 订阅）：started 是「进行中」状态，只写状态栏提示，不弹结果窗；
// stopped 后刷新设备端文件列表。
// 状态栏只有一行 lastMsg：记住「抓包已开始」是谁写的，停止/异常/设备移除时只清这一条，
// 不误伤别的进行中提示（如录屏 / 连拍）。
let captureMsgSerial = ''
function setCaptureStatus(serial) {
  captureMsgSerial = serial
  lastMsg.value = t('status.captureStarted') + serial
}
function clearCaptureStatus(serial) {
  if (!serial || captureMsgSerial !== serial) return
  captureMsgSerial = ''
  if (lastMsg.value === t('status.captureStarted') + serial) lastMsg.value = ''
}

function onNetcapStarted(p) { if (p && p.serial) { capturing[p.serial] = true; setCaptureStatus(p.serial) } }

function onNetcapStopped(p) {
  if (!p || !p.serial) return
  capturing[p.serial] = false
  clearCaptureStatus(p.serial)
  if (captureOpen.value) refreshCaptures()
  if (p.fallback) toast(t('toast.capturePidLost'))
}

function onNetcapError(p) {
  if (!p || !p.serial) return
  clearCaptureStatus(p.serial)
  toast(t('toast.captureError') + (p.text || ''))
}

async function takeScreenshot() {
  if (!selectedSerial.value) { showResult(t('action.screenshot'), t('err.noDevice'), false); return }
  const outPath = await api.invoke('file:pickSave', {
    defaultPath: (cfg.value.outDir || '') + '/screenshot.png',
    filters: [{ name: 'PNG', extensions: ['png'] }]
  })
  if (!outPath) return
  try {
    const p = await api.invoke('media:screenshot', { serial: selectedSerial.value, outPath })
    showResult(t('action.screenshot'), t('toast.screenshotSaved') + p, true)
  } catch (e) { showResult(t('action.screenshot'), t('toast.screenshotFailed') + e.message, false) }
}

async function startRec() {
  if (!selectedSerial.value) { showResult(t('modal.record'), t('err.noDevice'), false); return }
  try {
    await api.invoke('media:recordStart', { serial: selectedSerial.value })
    recording.value = true
    // 「录屏中」是进行中的状态、不是结果：保留在状态栏，不弹窗
    lastMsg.value = t('status.recording')
  } catch (e) { showResult(t('modal.record'), t('toast.recordStartFailed') + e.message, false) }
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
    showResult(t('modal.record'), t('toast.recordSaved') + p, true)
  } catch (e) { showResult(t('modal.record'), t('toast.recordStopFailed') + e.message, false) }
}

function shotName() {
  const d = new Date()
  return 'screenshot_' + ymdhms(d) + '_' + sanitizeSerial(selectedSerial.value) + '.png'
}

// quiet=true 用于「连续截图」定时流：逐张弹窗会每秒抢占焦点，只刷新状态栏进行中提示。
async function doScreenshotToDir(dir, quiet = false) {
  if (!selectedSerial.value) {
    showResult(t('action.screenshot'), t('err.noDevice'), false, { dedupe: 'screenshotNoDevice' })
    return false
  }
  const name = shotName()
  try {
    const p = await api.invoke('media:screenshotToDir', { serial: selectedSerial.value, dir, name })
    if (quiet) lastMsg.value = t('status.shotSaved') + p
    else showResult(t('action.screenshot'), t('toast.screenshotSaved') + p, true)
    return true
  } catch (e) {
    if (quiet) lastMsg.value = t('status.shotFailed') + e.message
    else showResult(t('action.screenshot'), t('toast.screenshotFailed') + e.message, false)
    return false
  }
}

async function screenshotToPath() {
  if (!selectedSerial.value) { showResult(t('action.screenshot'), t('err.noDevice'), false); return }
  const dir = cfg.value.screenshotDir || cfg.value.outDir || '.'
  await doScreenshotToDir(dir)
}

function toggleScreenshotTimer() {
  if (screenshotting.value) {
    if (screenshotTimer) { clearInterval(screenshotTimer); screenshotTimer = null }
    screenshotting.value = false
    lastMsg.value = ''
    showResult(t('modal.continuousShot'), t('toast.shotStopped'), true)
    return
  }
  if (!selectedSerial.value) { showResult(t('modal.continuousShot'), t('err.noDevice'), false); return }
  const dir = cfg.value.screenshotDir || cfg.value.outDir || '.'
  const interval = Math.max(200, Number(cfg.value.screenshotInterval) || 1000)
  screenshotting.value = true
  doScreenshotToDir(dir, true) // 立即先截一张
  screenshotTimer = setInterval(() => doScreenshotToDir(dir, true), interval)
  // 启动/进行中属于状态，保留在状态栏
  lastMsg.value = t('status.shotStartedPrefix') + interval + t('status.shotStartedSuffix') + dir
}

async function startCapture() {
  if (!selectedSerial.value) { toast(t('err.selectDeviceShort')); return }
  try {
    await api.invoke('netcap:start', {
      serial: selectedSerial.value,
      deviceDir: cfg.value.captureDeviceDir,
      args: cfg.value.captureArgs,
      asRoot: cfg.value.captureAsRoot
    })
    capturing[selectedSerial.value] = true
    toast(t('toast.capturing'))
  } catch (e) { toast(t('toast.captureStartFailed') + e.message) }
}

async function stopCapture() {
  const s = selectedSerial.value
  if (!s) return
  try {
    await api.invoke('netcap:stop', { serial: s, deviceDir: cfg.value.captureDeviceDir, asRoot: cfg.value.captureAsRoot })
    capturing[s] = false
    clearCaptureStatus(s)   // 事件推送已清过则为空操作；若事件丢失也必须让状态栏复位
    toast(t('toast.captureStopped'))
  } catch (e) { toast(t('toast.captureStopFailed') + e.message) }
}

function openCaptureManager() {
  if (!selectedSerial.value) { toast(t('err.selectDeviceShort')); return }
  captureOpen.value = true
  refreshCaptures()
}

async function refreshCaptures() {
  if (!selectedSerial.value) return
  try {
    const r = await api.invoke('netcap:list', { serial: selectedSerial.value, deviceDir: cfg.value.captureDeviceDir, asRoot: cfg.value.captureAsRoot })
    const s = selectedSerial.value
    captureList[s] = r.items || []
    // 重启 / 切设备 / 重连后按设备端 current.pid 还原「抓包中」状态；
    // 只有明确拿到 running 字段才改状态，IPC 失败时保留原样。
    if (typeof r.running === 'boolean') {
      capturing[s] = r.running
      if (r.running) setCaptureStatus(s)
      else clearCaptureStatus(s)
    }
  } catch (e) { toast(t('toast.captureListFailed') + e.message) }
}

async function pullCapture(item) {
  if (!selectedSerial.value) return
  try {
    const localDir = cfg.value.captureLocalDir || (cfg.value.outDir + '/captures')
    const r = await api.invoke('netcap:pull', { serial: selectedSerial.value, devicePath: item.path, localDir, asRoot: cfg.value.captureAsRoot })
    toast(t('toast.downloaded') + r.localPath)
  } catch (e) { toast(t('toast.downloadFailed') + e.message) }
}

async function deleteCapture(item) {
  if (!selectedSerial.value) return
  try {
    await api.invoke('netcap:rm', { serial: selectedSerial.value, devicePath: item.path, asRoot: cfg.value.captureAsRoot })
    await refreshCaptures()
  } catch (e) { toast(t('toast.deleteFailed') + e.message) }
}

async function copyCapturePath(item) {
  try { await api.invoke('clipboard:write', { text: item.path }); toast(t('toast.pathCopied') + item.path) } catch { toast(t('toast.copyFailed')) }
}

let screenshotTimer = null
export function useMedia() {

  return { clearCaptureStatus, copyCapturePath, deleteCapture, doScreenshotToDir, onNetcapError, onNetcapStarted, onNetcapStopped, openCaptureManager, pullCapture, refreshCaptures, screenshotToPath, shotName, startCapture, startRec, stopCapture, stopRec, takeScreenshot, toggleScreenshotTimer }
}
export { clearCaptureStatus, copyCapturePath, deleteCapture, doScreenshotToDir, onNetcapError, onNetcapStarted, onNetcapStopped, openCaptureManager, pullCapture, refreshCaptures, screenshotToPath, shotName, startCapture, startRec, stopCapture, stopRec, takeScreenshot, toggleScreenshotTimer }