// 离线日志：设备端 nohup logcat 后台落盘 + 管理弹窗（列表 / 下载 / 复制路径 / 删除 / 当前缓冲导出）。
// 状态栏只有一行 lastMsg：记录「离线日志已开始」是谁写的，停止时只清这一条。
import { t } from '@/i18n'
import {
  OFFLINELOG_START, OFFLINELOG_STOP, OFFLINELOG_LIST, OFFLINELOG_PULL, OFFLINELOG_RM, OFFLINELOG_DUMP,
  OFFLINELOG_STARTED, OFFLINELOG_STOPPED
} from '@shared/ipc-channels.js'
import {
  api, cfg, lastMsg, offlineLogBusy, offlineLogCapturing, offlineLogLastDownload,
  offlineLogList, offlineLogOpen, offlineLogPid, selectedSerial, showResult, ymdhms
} from './state'
import { sanitizeSerial } from './shared'
import { toast } from './useUi'
import { runTask } from './useTask'

let logMsgSerial = ''
function setOfflineLogStatus(serial) {
  logMsgSerial = serial
  lastMsg.value = t('status.offlineLogStarted') + serial
}
function clearOfflineLogStatus(serial) {
  if (!serial || logMsgSerial !== serial) return
  logMsgSerial = ''
  if (lastMsg.value === t('status.offlineLogStarted') + serial) lastMsg.value = ''
}

function onOfflineLogStarted(p) {
  if (!p || !p.serial) return
  offlineLogCapturing[p.serial] = true
  setOfflineLogStatus(p.serial)
}

function onOfflineLogStopped(p) {
  if (!p || !p.serial) return
  offlineLogCapturing[p.serial] = false
  clearOfflineLogStatus(p.serial)
  if (offlineLogOpen.value) refreshOfflineLogs()
  if (p.fallback) toast(t('toast.offlineLogPidLost'))
}

function openOfflineLogManager() {
  if (!selectedSerial.value) { toast(t('err.selectDeviceShort')); return }
  offlineLogOpen.value = true
  offlineLogLastDownload.value = ''
  refreshOfflineLogs()
}

async function refreshOfflineLogs() {
  if (!selectedSerial.value) return
  try {
    const r = await api.invoke(OFFLINELOG_LIST, {
      serial: selectedSerial.value, deviceDir: cfg.value.offlineLogDeviceDir, asRoot: cfg.value.offlineLogAsRoot
    })
    const s = selectedSerial.value
    offlineLogList[s] = r.items || []
    // 重开软件 / 切设备后按设备端 current.pid 还原「抓日志中」状态
    if (typeof r.running === 'boolean') {
      offlineLogCapturing[s] = r.running
      if (r.running) setOfflineLogStatus(s)
      else clearOfflineLogStatus(s)
    }
  } catch (e) { toast(t('toast.offlineLogListFailed') + e.message) }
}

async function startOfflineLog() {
  if (!selectedSerial.value) { toast(t('err.selectDeviceShort')); return }
  try {
    await api.invoke(OFFLINELOG_START, {
      serial: selectedSerial.value,
      deviceDir: cfg.value.offlineLogDeviceDir,
      args: cfg.value.offlineLogArgs,
      asRoot: cfg.value.offlineLogAsRoot,
      pid: offlineLogPid.value
    })
    offlineLogCapturing[selectedSerial.value] = true
    toast(t('toast.offlineLogStarted'))
    refreshOfflineLogs()
  } catch (e) { toast(t('toast.offlineLogStartFailed') + e.message) }
}

async function stopOfflineLog() {
  const s = selectedSerial.value
  if (!s) return
  try {
    await api.invoke(OFFLINELOG_STOP, {
      serial: s, deviceDir: cfg.value.offlineLogDeviceDir, asRoot: cfg.value.offlineLogAsRoot
    })
    offlineLogCapturing[s] = false
    clearOfflineLogStatus(s)   // 事件丢失时也必须复位状态栏
    toast(t('toast.offlineLogStopped'))
    refreshOfflineLogs()
  } catch (e) { toast(t('toast.offlineLogStopFailed') + e.message) }
}

async function pullOfflineLog(item) {
  if (!selectedSerial.value || offlineLogBusy.value) return
  offlineLogBusy.value = true   // 弹窗置灰，阻止重复点击 / 关闭
  offlineLogLastDownload.value = ''
  try {
    // 默认目录 = 日志保存目录（cfg.outDir），用户可在系统对话框里改路径
    const localPath = await api.invoke('file:pickSave', {
      defaultPath: (cfg.value.outDir || '') + '/' + item.name,
      filters: [{ name: 'LOG', extensions: ['log', 'txt'] }]
    })
    if (!localPath) return
    const r = await api.invoke(OFFLINELOG_PULL, {
      serial: selectedSerial.value, devicePath: item.path, localPath, asRoot: cfg.value.offlineLogAsRoot
    })
    offlineLogLastDownload.value = r.localPath
    toast(t('toast.downloaded') + r.localPath)
  } catch (e) { toast(t('toast.downloadFailed') + e.message) }
  finally { offlineLogBusy.value = false }
}

async function copyDownloadPath() {
  if (!offlineLogLastDownload.value) return
  try {
    await api.invoke('clipboard:write', { text: offlineLogLastDownload.value })
    toast(t('toast.pathCopied') + offlineLogLastDownload.value)
  } catch { toast(t('toast.copyFailed')) }
}

async function deleteOfflineLog(item) {
  if (!selectedSerial.value) return
  try {
    await api.invoke(OFFLINELOG_RM, {
      serial: selectedSerial.value, devicePath: item.path, asRoot: cfg.value.offlineLogAsRoot
    })
    await refreshOfflineLogs()
  } catch (e) { toast(t('toast.deleteFailed') + e.message) }
}

async function copyOfflineLogPath(item) {
  try { await api.invoke('clipboard:write', { text: item.path }); toast(t('toast.pathCopied') + item.path) } catch { toast(t('toast.copyFailed')) }
}

// 立即导出当前 logcat 缓冲（logcat -d [--pid=N] <args>），文本由用户选路径落盘。
async function dumpOfflineLog() {
  if (!selectedSerial.value) { toast(t('err.selectDeviceShort')); return }
  const serial = selectedSerial.value
  const defaultName = 'logcat_' + ymdhms(new Date()) + '_' + sanitizeSerial(serial) + '.log'
  await runTask({
    key: 'offlinelog:dump:' + serial,
    label: t('offlinelog.dump'),
    busyText: t('busy.offlineLogDump'),
    task: async () => {
      const r = await api.invoke(OFFLINELOG_DUMP, {
        serial, args: cfg.value.offlineLogArgs, pid: offlineLogPid.value, asRoot: cfg.value.offlineLogAsRoot
      })
      if (!r.text) return { ok: false, text: t('offlinelog.dumpEmpty') }
      const p = await api.invoke('file:saveText', {
        content: r.text,
        defaultPath: (cfg.value.offlineLogLocalDir || cfg.value.outDir) + '/' + defaultName,
        filters: [{ name: 'LOG', extensions: ['log'] }]
      })
      if (!p) return { ok: false, text: '' }
      return { ok: true, text: t('toast.offlineLogDumped') + p, level: 'toast' }
    }
  })
}

export function useOfflineLog() {
  return {
    clearOfflineLogStatus, copyDownloadPath, copyOfflineLogPath, deleteOfflineLog, dumpOfflineLog, onOfflineLogStarted,
    onOfflineLogStopped, openOfflineLogManager, pullOfflineLog, refreshOfflineLogs, startOfflineLog, stopOfflineLog
  }
}
export {
  clearOfflineLogStatus, copyDownloadPath, copyOfflineLogPath, deleteOfflineLog, dumpOfflineLog, onOfflineLogStarted,
  onOfflineLogStopped, openOfflineLogManager, pullOfflineLog, refreshOfflineLogs, startOfflineLog, stopOfflineLog
}
