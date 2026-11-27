// 由 split_app2.cjs 自动拆分生成（app）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {activeLogSerial, api, alwaysOnTop, logErrMap, maximized, procsMap, refreshing, runningMap} from './state'
import { APP_UPDATE_AVAILABLE, I18N_CATALOG, I18N_LOAD, OFFLINELOG_STARTED, OFFLINELOG_STOPPED } from '@shared/ipc-channels.js'
import { setLocale, setKeycodeMode, t } from '@/i18n'
import { onUpdateAvailable } from './useUpdate'
import { applyConfig, loadSystemFonts, onDocMouseDown, saveCfg } from './useConfig'
import { onNetcapError, onNetcapStarted, onNetcapStopped, refreshCaptures } from './useMedia'
import { onOfflineLogStarted, onOfflineLogStopped, refreshOfflineLogs } from './useOfflineLog'
import { onData, onFindWinFocusChange, onGlobalKey, refreshProcs, stopAutoLogFlush } from './useLogcat'
import { refreshDevices } from './useDevices'

let offData, offErr, offStderr, offClosed, offMax, offDevicesChanged, offProcChanged, offNetcapStarted, offNetcapStopped, offNetcapError, offOfflineLogStarted, offOfflineLogStopped, offUpdate
let startupProcTimer = null

// 语言包加载：先取目录信息（首次触发主进程懒扫盘），再按 id 取合并词条。
// force=true 用于「重新加载语言包」与切换语言 —— 外部文件改动立即生效。
export async function loadI18n(id, force = false) {
  try {
    // catalog.current 是主进程已按系统语言探测出的 id；渲染层不得再硬编码 zh-CN 覆盖它。
    const catalog = await api.invoke(I18N_CATALOG)
    const target = id || (catalog && catalog.current) || 'zh-CN'
    const data = await api.invoke(I18N_LOAD, { id: target, force })
    setLocale(data)
    document.title = t('app.title')
    document.documentElement.lang = data.id || 'zh-CN'
    return data
  } catch (e) {
    console.warn('[i18n] 语言包加载失败，沿用内置中文', e)
    return null
  }
}

export function useApp() {
onMounted(async () => {
  const c = await api.invoke('config:get')
  applyConfig(c)
  // lang 为空时传空串，让主进程的系统语言探测结果生效（见 loadI18n）
  await loadI18n(c.lang || '')
  setKeycodeMode(c.keycodeLangMode || 'follow')
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
  // 离线日志事件订阅：设备端 nohup logcat 的启停状态
  offOfflineLogStarted = api.on(OFFLINELOG_STARTED, onOfflineLogStarted)
  offOfflineLogStopped = api.on(OFFLINELOG_STOPPED, onOfflineLogStopped)
  // 版本升级检测：订阅主进程推送的「有更新」通知
  offUpdate = api.on(APP_UPDATE_AVAILABLE, onUpdateAvailable)

  await refreshDevices()
  // 离线抓包 / 离线日志在应用关闭后仍由设备端 nohup 进程写盘；
  // 启动后按设备目录 current.pid 探活，还原状态栏与按钮状态。
  refreshCaptures()
  refreshOfflineLogs()
  loadSystemFonts()   // 异步填充「日志字体」下拉为系统已安装字体（失败则保留兜底选项）
  // 启动补拉：冷启动瞬间 adb server 未就绪会让首轮 ps 失败，3 秒后若仍无列表再试一次。
  // refreshProcs 内部有按 serial 去重和超时，重复触发不会叠加 adb 子进程。
  startupProcTimer = setTimeout(() => {
    startupProcTimer = null
    if (activeLogSerial.value && !(procsMap[activeLogSerial.value] || []).length) refreshProcs(activeLogSerial.value)
  }, 3000)
})
onBeforeUnmount(() => {
  offData && offData(); offErr && offErr(); offStderr && offStderr(); offClosed && offClosed(); offMax && offMax(); offDevicesChanged && offDevicesChanged(); offProcChanged && offProcChanged()
  offNetcapStarted && offNetcapStarted(); offNetcapStopped && offNetcapStopped(); offNetcapError && offNetcapError(); offOfflineLogStarted && offOfflineLogStarted(); offOfflineLogStopped && offOfflineLogStopped(); offUpdate && offUpdate()
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onGlobalKey)
  document.removeEventListener('focusin', onFindWinFocusChange)
  if (startupProcTimer) { clearTimeout(startupProcTimer); startupProcTimer = null }
  stopAutoLogFlush()
  // 离线抓包 / 离线日志刻意不停：设备端 nohup 进程继续写盘，重开软件后按 PID 文件恢复状态
  saveCfg(true)   // 退出必须立即落盘，去抖的 200ms 等不到窗口销毁
})

  return {  }
}