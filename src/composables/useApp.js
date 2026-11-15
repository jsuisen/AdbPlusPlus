// 由 split_app2.cjs 自动拆分生成（app）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {api, alwaysOnTop, capturing, logErrMap, maximized, refreshing, runningMap} from './state'
import { APP_UPDATE_AVAILABLE } from '@shared/ipc-channels.js'
import { onUpdateAvailable } from './useUpdate'
import { applyConfig, loadSystemFonts, onDocMouseDown, saveCfg } from './useConfig'
import { onNetcapError, onNetcapStarted, onNetcapStopped } from './useMedia'
import { onData, onFindWinFocusChange, onGlobalKey, refreshProcs, stopAutoLogFlush } from './useLogcat'
import { refreshDevices } from './useDevices'

let offData, offErr, offStderr, offClosed, offMax, offDevicesChanged, offProcChanged, offNetcapStarted, offNetcapStopped, offNetcapError, offUpdate
export function useApp() {
onMounted(async () => {
  const c = await api.invoke('config:get')
  applyConfig(c)
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onGlobalKey)   // Ctrl+F 打开查找窗口 / Esc 关闭
  document.addEventListener('focusin', onFindWinFocusChange)   // 查找窗口「失去焦点后」透明：重新获得焦点即恢复不透明

  offData = api.on('logcat:data', onData)
  offErr = api.on('logcat:error', (p) => { if (p && p.serial) logErrMap[p.serial] = p.text })
  // adb 的 stderr 提示（如 waiting for device）此前主进程在发、前端无人接收，直接被丢弃。
  // 分片文本按设备累加但限长，避免把状态栏撑爆。展示位：App.vue 的 currentLogErr。
  offStderr = api.on('logcat:stderr', (p) => {
    if (!p || !p.serial) return
    const t = String(p.text || '').trim()
    if (!t) return
    const prev = logErrMap[p.serial] || ''
    logErrMap[p.serial] = (prev + (prev ? '\n' : '') + t).slice(-500)
  })
  offClosed = api.on('logcat:closed', (serial) => { runningMap[serial] = false })
  try { maximized.value = await api.invoke('window:isMaximized') } catch {}
  try { alwaysOnTop.value = !!(await api.invoke('window:isAlwaysOnTop')) } catch {}
  offMax = api.on('window:maximize-state', (v) => { maximized.value = !!v })
  offDevicesChanged = api.on('adb:devicesChanged', () => { if (!refreshing.value) refreshDevices() })
  offProcChanged = api.on('proc:changed', (serial) => refreshProcs(serial))   // 日志流中检测到进程启停即刷新该设备进程下拉
  // 网络抓包事件订阅
  offNetcapStarted = api.on('netcap:started', onNetcapStarted)
  offNetcapStopped = api.on('netcap:stopped', onNetcapStopped)
  offNetcapError = api.on('netcap:error', onNetcapError)
  // 版本升级检测：订阅主进程推送的「有更新」通知
  offUpdate = api.on(APP_UPDATE_AVAILABLE, onUpdateAvailable)

  await refreshDevices()
  loadSystemFonts()   // 异步填充「日志字体」下拉为系统已安装字体（失败则保留兜底选项）
})
onBeforeUnmount(() => {
  offData && offData(); offErr && offErr(); offStderr && offStderr(); offClosed && offClosed(); offMax && offMax(); offDevicesChanged && offDevicesChanged(); offProcChanged && offProcChanged()
  offNetcapStarted && offNetcapStarted(); offNetcapStopped && offNetcapStopped(); offNetcapError && offNetcapError(); offUpdate && offUpdate()
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onGlobalKey)
  document.removeEventListener('focusin', onFindWinFocusChange)
  stopAutoLogFlush()
  // 窗口关闭时停掉所有仍在跑的抓包，避免设备端 tcpdump 残留
  for (const s of Object.keys(capturing)) { if (capturing[s]) { try { api.invoke('netcap:stop', s) } catch {} } }
  saveCfg(true)   // 退出必须立即落盘，去抖的 200ms 等不到窗口销毁
})

  return {  }
}