// 由 split_app2.cjs 自动拆分生成（devices）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {activeLogSerial, api, appPkg, autoLogBufMap, autoLogMeta, capturing, captureList, cfg, colorSessionMap, connectAlias, connectHistorySel, connectIp, connectOpen, connectPort, connecting, connectTimedOut, CONNECT_TIMEOUT_MS, devGroups, devInvoke, deviceAlias, deviceCtxMenu, devices, fileModalMode, fileModalOpen, groupOpen, keyModalOpen, logErrMap, logsMap, monkeyModalOpen, permModalOpen, permMode, procsMap, quickCommands, rebootModalOpen, recording, refreshing, renameOpen, renameSerial, renameValue, runningMap, screenshotting, selectedProc, selectedSerial, cmdDetail, showResult} from './state'
import { t } from '@/i18n'
import { enableAutoscroll, ensureLogFilter, loadProcToPkg, refreshProcs, startLogcat, stopLogcat } from './useLogcat'
import { toast } from './useUi'
import { openActModal } from './useDeviceinfo'
import { openCmdModal, openInputModal, openInstallModal, openUninstallModal, resetFileForm } from './useActions'
import { openCaptureManager, screenshotToPath, startCapture, startRec, stopCapture, stopRec, takeScreenshot, toggleScreenshotTimer } from './useMedia'
import { installApk, parseInstalled, parseLocal } from './useApk'
import { saveCfg } from './useConfig'

// 设备移除时统一回收该 serial 的会话状态。
// 旧实现有两份拷贝且只删 6 个字典，本函数补齐运行态缓存。
// 刻意保留用户手动录入 / 主动设置的状态（跨断开重连不丢，只存内存、不落盘）：
// notesMap 注释、deviceAlias 别名、_logFilter 过滤条件、scrollPosMap 滚动位置。
// 设备日志本身与采集 / 抓包 / 自动落盘会话仍按会话清理。
function purgeDeviceSession(serial) {
  if (!serial) return
  if (runningMap[serial]) { try { api.send('logcat:stop', serial) } catch {} }
  delete logsMap[serial]; delete runningMap[serial]; delete logErrMap[serial]
  delete procsMap[serial]; delete autoLogBufMap[serial]; delete autoLogMeta[serial]
  delete colorSessionMap[serial]; delete captureList[serial]; delete capturing[serial]
}

async function refreshDevices() {
  if (refreshing.value) return   // 防止设备事件与定时器并发刷新叠加
  refreshing.value = true
  try {
    const all = await api.invoke('adb:devices')
    // 用户点过「关闭」的设备即使被 adb server 重新列出也不再进入侧栏
    const hidden = new Set(Array.isArray(cfg.value.hiddenSerials) ? cfg.value.hiddenSerials : [])
    const list = all.filter((d) => !hidden.has(d.serial))
    const newSerials = list.map((d) => d.serial)
    // 清理已移除设备的日志会话与缓存（停掉其 logcat，删映射，避免内存泄漏）
    for (const s of Object.keys(logsMap)) {
      if (!newSerials.includes(s)) purgeDeviceSession(s)
    }
    for (const s of newSerials) { if (!logsMap[s]) logsMap[s] = []; ensureLogFilter(s) }
    devices.value = list
    if (!selectedSerial.value || !list.some((d) => d.serial === selectedSerial.value)) {
      selectedSerial.value = list[0]?.serial || ''
      activeLogSerial.value = selectedSerial.value
    }
    // 进程列表不阻塞设备列表：adb shell ps 在网络设备上可能很慢，旧实现 await 它期间
    // refreshing 一直为 true，后续 devicesChanged 全被守卫吞掉，界面看起来「卡死」。
    // 进程拉取自身有并发去重 + 超时，结果到齐后自行填入下拉。
    refreshProcs(activeLogSerial.value)
  } catch (e) {
    // adb server 冷启动偶发失败：保留已显示的设备，等下一次 devicesChanged 自然校正；
    // 直接置空会让「包名进程」下拉被禁用成空白，且没有任何自恢复入口。
  } finally {
    refreshing.value = false
  }
}

function selectDevice(serial) {
  selectedSerial.value = serial
  activeLogSerial.value = serial
  ensureLogFilter(serial)
  refreshProcs(serial)
}

function toggleDeviceLogcat(serial) {
  if (!serial) return
  if (runningMap[serial]) stopLogcat(serial)
  else { activeLogSerial.value = serial; startLogcat(serial) }
}

function removeDeviceFromView(serial) {
  if (!serial) return
  purgeDeviceSession(serial)
  devices.value = devices.value.filter((d) => d.serial !== serial)
  if (selectedSerial.value === serial) selectedSerial.value = devices.value[0]?.serial || ''
  if (activeLogSerial.value === serial) activeLogSerial.value = selectedSerial.value
}

// 连接/重连成功后解除隐藏，避免设备永远回不到侧栏
function clearHiddenSerial(serial) {
  if (!serial || !Array.isArray(cfg.value.hiddenSerials)) return
  cfg.value.hiddenSerials = cfg.value.hiddenSerials.filter((s) => s !== serial)
  saveCfg()
}

async function disconnectDevice(serial) {
  if (!serial) return
  const isNet = serial.includes(':')
  if (!isNet) toast(t('toast.usbRemoved'))
  removeDeviceFromView(serial)
  if (isNet) {
    // 记住被关闭的网络设备：adb server 可能残留 offline 条目并在后续刷新中再次列出
    const hidden = Array.isArray(cfg.value.hiddenSerials) ? cfg.value.hiddenSerials : (cfg.value.hiddenSerials = [])
    if (!hidden.includes(serial)) { hidden.push(serial); saveCfg() }
    try {
      const r = await api.invoke('adb:disconnect', { serial })
      if (r.code !== 0) toast(t('toast.disconnectNonZero') + (r.out || r.err || r.code))
    } catch (e) {
      // 主进程未注册该通道（如未重启即改了 main 进程代码）时，设备已从视图移除，仅提示命令未执行
      toast(t('toast.disconnectSkipped') + e.message)
    } finally {
      // 以 adb server 的真实列表为准重新同步：offline 条目被清掉后不要留在侧栏
      await refreshDevices()
    }
  }
}

// 连接/重连成功后：把目标设备切为当前日志设备并自动开始采集（等价于点日志窗口「开始」）。
// 必须先对齐 activeLogSerial，否则「开始/停止」按钮绑定的是旧设备，看起来没有自动开始。
// runningMap 守卫避免重复 start 造成两条 adb logcat 子进程；日志缓冲不清，历史日志保留。
function autoStartLogcatOnConnect(serial) {
  if (!serial) return
  selectedSerial.value = serial
  activeLogSerial.value = serial
  ensureLogFilter(serial)
  if (!runningMap[serial]) startLogcat(serial)
  // 底部跟随自动激活：新日志始终停在最新一行
  enableAutoscroll()
}

// 重连：仅网络设备 serial 形如 ip:port，adb disconnect 断开服务端连接，等 1 秒再 adb connect 回去。
// USB 本地设备无法用 adb disconnect 移除，直接提示用户重新插拔。
// 两步都走 adb:run（参数数组 spawn，不拼 shell）；connect 步骤带 runId + 看门狗，
// 避免设备无响应时 adb connect 挂死渲染进程，与连接弹窗共用 CONNECT_TIMEOUT_MS。
async function reconnectDevice(serial) {
  if (!serial) return
  if (!serial.includes(':')) { toast(t('err.usbReconnect')); return }
  toast(t('toast.reconnecting') + serial)
  try {
    const disc = await api.invoke('adb:run', ['disconnect', serial])
    await new Promise((r) => setTimeout(r, 1000))
    const runId = 'reconnect-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
    let timer = null
    const watchdog = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), CONNECT_TIMEOUT_MS)
    })
    let conn
    try {
      conn = await Promise.race([
        api.invoke('adb:run', ['connect', serial], runId),
        watchdog
      ])
    } catch (e) {
      if (e && e.message === 'CONNECT_TIMEOUT') {
        try { await api.invoke('adb:runCancel', runId) } catch {}
        throw new Error('连接超时（' + (CONNECT_TIMEOUT_MS / 1000) + ' 秒），请检查设备网络')
      }
      throw e
    } finally {
      if (timer) clearTimeout(timer)
    }
    const ok = conn.code === 0
    const detail = cmdDetail(disc, 'adb disconnect ' + serial) + '\n' + cmdDetail(conn, 'adb connect ' + serial)
    showResult(t('modal.reconnect'), (ok ? t('toast.reconnected') : t('toast.reconnectFailed')) + serial + '\n' + detail, ok)
    if (ok) {
      clearHiddenSerial(serial)
      await refreshDevices()
      autoStartLogcatOnConnect(serial)
    }
  } catch (e) {
    showResult(t('modal.reconnect'), t('toast.reconnectError') + (e && e.message ? e.message : e), false)
  }
}

async function adbDevices() {
  try {
    const r = await api.invoke('adb:run', ['devices'])
    const body = `[exit ${r.code}]\n${r.out}${r.err}`
    openCmdModal('$ adb devices', body, `$ adb devices\n\n${body}`)
  } catch (e) { toast(t('toast.execFailed') + e.message) }
}

async function adbDisconnectAll() {
  try {
    const r = await api.invoke('adb:run', ['disconnect'])
    toast((r.code === 0 ? t('toast.allDisconnected') : t('toast.disconnectFailed')) + (r.out || r.err || r.code))
    await refreshDevices()
  } catch (e) { toast(t('toast.execFailed') + e.message) }
}

async function adbKillServer() {
  try {
    const r = await api.invoke('adb:run', ['kill-server'])
    toast(r.code === 0 ? t('toast.adbServerStopped') : t('toast.stopFailed') + (r.out || r.err || r.code))
    // 服务器停止后设备列表应清空；即便刷新因服务器未起而异常，也强制置空
    await refreshDevices().catch(() => { devices.value = [] })
  } catch (e) { toast(t('toast.execFailed') + e.message) }
}

function toggleGroup(k) { groupOpen[k] = !groupOpen[k] }

function expandAll() { for (const g of devGroups) groupOpen[g.key] = true }

function collapseAll() { for (const g of devGroups) groupOpen[g.key] = false }

async function runAction(item) {
  const effLabel = (item.act === 'recordStart' && recording.value) ? t('action.stopRecord')
    : (item.act === 'screenshotTimer' && screenshotting.value) ? t('action.stopScreenshot')
    : (item.labelKey ? t(item.labelKey) : item.label)
  toast(t('toast.clicked', { label: effLabel }))
  if (item.needPkg && !appPkg.value) { showResult(t('modal.deviceAction'), t('err.inputPkg'), false); return }
  switch (item.act) {
    case 'appStart': return devInvoke(t('action.appStart'), 'adb:appStart', { pkg: appPkg.value })
    case 'appStop': return devInvoke(t('action.appStop'), 'adb:appStop', { pkg: appPkg.value })
    case 'procKill': {
      // 停止进程：优先杀掉日志窗口当前选中的具体进程；否则杀掉该包名下所有运行进程的 pid。
      // 与「停止应用」(am force-stop 整包) 区分：可精确终止某一私有进程(如 :remote)。
      const procs = procsMap[selectedSerial.value] || []
      const base = appPkg.value
      let targets = procs.filter((p) => p.pkg.split(':')[0] === base)
      if (selectedProc.value) {
        const exact = procs.filter((p) => p.pkg === selectedProc.value)
        if (exact.length) targets = exact
      }
      if (!targets.length) { showResult(t('action.procKill'), t('toast.noProcess') + base + '）', false); break }
      const pids = targets.map((t) => String(t.pid))
      const killArgs = ['-s', selectedSerial.value, 'shell', 'kill', '-9', ...pids]
      try {
        const r = await api.invoke('adb:run', killArgs)
        const ok = r.code === 0
        const text = (ok ? t('toast.processKilled') + targets.map((t) => t.pkg + '(' + t.pid + ')').join(', ') : t('toast.killFailed') + (r.err || r.code)) + '\n' + cmdDetail(r, 'adb ' + killArgs.join(' '))
        showResult(t('action.procKill'), text, ok)
      } catch (e) { showResult(t('action.procKill'), t('toast.killError') + e.message, false) }
      break
    }
    case 'appRestart': return devInvoke(t('action.appRestart'), 'adb:appRestart', { pkg: appPkg.value })
    case 'appClear': return devInvoke(t('action.appClear'), 'adb:appClear', { pkg: appPkg.value })
    case 'appClearRestart': return devInvoke(t('action.appClearRestart'), 'adb:appClearRestart', { pkg: appPkg.value })
    case 'loadPkg': return loadProcToPkg()
    case 'appUninstall': return openUninstallModal()
    case 'screenshot': return takeScreenshot()
    case 'screenshotToPath': return screenshotToPath()
    case 'screenshotTimer': return toggleScreenshotTimer()
    case 'recordStart': return recording.value ? stopRec() : startRec()
    case 'inputText': { openInputModal('text'); return }
    case 'inputKey': { keyModalOpen.value = true; return }
    case 'inputTap': { openInputModal('tap'); return }
    case 'inputSwipe': { openInputModal('swipe'); return }
    case 'installApk': return openInstallModal()
    case 'connectDevice': return openConnectModal()
    case 'clearDeviceCache': return devInvoke(t('action.clearDeviceCache'), 'adb:clearDeviceCache', {})
    case 'parseLocal': return parseLocal()
    case 'parseInstalled': return parseInstalled()
    case 'actActivity': { openActModal('activity'); return }
    case 'actStartService': { openActModal('startService'); return }
    case 'actStopService': { openActModal('stopService'); return }
    case 'actBroadcast': { openActModal('broadcast'); return }
    case 'monkey': { monkeyModalOpen.value = true; return }
    case 'grant': { permModalOpen.value = true; permMode.value = 'grant'; return }
    case 'revoke': { permModalOpen.value = true; permMode.value = 'revoke'; return }
    case 'pushFile': { fileModalOpen.value = true; fileModalMode.value = 'push'; resetFileForm(); return }
    case 'pullFile': { fileModalOpen.value = true; fileModalMode.value = 'pull'; resetFileForm(); return }
    case 'reboot': { rebootModalOpen.value = true; return }
    case 'root': return devInvoke('root', 'adb:root', {})
    case 'unroot': return devInvoke('unroot', 'adb:unroot', {})
    case 'remount': return devInvoke('remount', 'adb:remount', {})
    case 'captureToggle': return capturing[selectedSerial.value] ? stopCapture() : startCapture()
    case 'captureManager': return openCaptureManager()
    case 'adbDevices': return adbDevices()
    case 'adbDisconnectAll': return adbDisconnectAll()
    case 'adbKillServer': return adbKillServer()
  }
}

function displayName(serial) { return (serial && deviceAlias[serial]) || serial || '' }

function openConnectModal(prefill) {
  if (prefill && typeof prefill === 'object') {
    connectIp.value = prefill.ip || ''
    connectPort.value = prefill.port || '5555'
    connectAlias.value = prefill.alias || ''
  } else {
    // 常规入口：回填上次连接过的 IP/端口；别名不跨连接继承，避免误覆盖新设备
    connectIp.value = cfg.value.lastConnectIp || ''
    connectPort.value = cfg.value.lastConnectPort || '5555'
    connectAlias.value = ''
  }
  connectHistorySel.value = ''
  connecting.value = false
  connectTimedOut.value = false
  connectOpen.value = true
}

// 「历史」下拉选中项：按 ip:port 找回记录回填三字段。回填后立即清空选中值，
// 保证再次选择同一历史项仍能触发 change（select 值不变时不会派发 change）。
function applyConnectHistory() {
  const key = connectHistorySel.value
  if (!key) return
  const hist = Array.isArray(cfg.value.connectHistory) ? cfg.value.connectHistory : []
  const hit = hist.find((h) => `${h.ip}:${h.port}` === key)
  connectHistorySel.value = ''
  if (!hit) return
  connectIp.value = hit.ip || ''
  connectPort.value = hit.port || '5555'
  connectAlias.value = hit.alias || ''
  connectTimedOut.value = false
}

// 当前连接尝试的私有句柄（不进 state，无 UI 绑定需求）：
// runId 作主进程可取消子进程的键；cancelled 用于抑制强杀后 AbortError 的误报。
let activeConnect = null

// 强杀底层 adb 子进程 + 显式 disconnect。
// adb 连接状态由 adb server 维护，仅杀 CLI 进程不会断连，必须再发 disconnect 清理。
async function abortConnect(runId, target, silent) {
  if (runId) {
    try { await api.invoke('adb:runCancel', runId) } catch {}
  }
  if (target) {
    let t = null
    try {
      await Promise.race([
        api.invoke('adb:run', ['disconnect', target]),
        new Promise((_, rej) => { t = setTimeout(() => rej(new Error('DISCONNECT_TIMEOUT')), 3000) })
      ])
    } catch {} finally { if (t) clearTimeout(t) }
  }
  if (!silent) toast(t('toast.connectCancelled') + target)
}

// 用户点「取消」：立即结束等待并强杀本次 adb connect
async function cancelConnect() {
  const attempt = activeConnect
  if (!attempt) { connecting.value = false; return }
  attempt.cancelled = true
  activeConnect = null   // 先清，防止重复点击触发两次强杀
  await abortConnect(attempt.runId, attempt.target, false)
  connecting.value = false
  connectTimedOut.value = false
}

async function confirmConnect() {
  if (connecting.value) return   // 连接中重复点确认直接忽略
  const ip = connectIp.value.trim()
  const port = connectPort.value.trim() || '5555'
  if (!ip) { toast(t('err.inputIp')); return }
  const target = `${ip}:${port}`

  // 上次值：点确认即记录（含失败尝试），与「仅成功才入历史」分开
  cfg.value.lastConnectIp = ip
  cfg.value.lastConnectPort = port
  saveCfg()

  // 连接期间保持弹窗打开，让用户看到「连接中…」；成功才关，失败/超时/取消留在弹窗里改
  connectTimedOut.value = false
  connecting.value = true
  const attempt = {
    target,
    cancelled: false,
    runId: 'connect-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
  }
  activeConnect = attempt
  let timer = null
  const watchdog = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('CONNECT_TIMEOUT')), CONNECT_TIMEOUT_MS)
  })
  try {
    // 第三参数 runId：主进程据此登记可取消的 adb 子进程；其它 adb:run 调用不传，行为不变
    const r = await Promise.race([
      api.invoke('adb:run', ['connect', target], attempt.runId),
      watchdog
    ])
    if (attempt.cancelled) return   // 已强杀，忽略迟到的成功响应
    const msg = (r.code === 0 ? t('toast.connected') : t('toast.connectFailed')) + (r.out || r.err || r.code)
    toast(msg)
    if (r.code === 0) {
      // 历史：按 ip:port 去重置顶；新别名非空则覆盖，未填则保留已有别名
      let hist = cfg.value.connectHistory
      if (!Array.isArray(hist)) hist = cfg.value.connectHistory = []
      const idx = hist.findIndex((h) => `${h.ip}:${h.port}` === target)
      if (idx >= 0) {
        const [old] = hist.splice(idx, 1)
        hist.unshift({ ip, port, alias: connectAlias.value.trim() || old.alias || '' })
      } else {
        hist.unshift({ ip, port, alias: connectAlias.value.trim() })
      }
      // 快捷命令：保持原有行为，避免重复
      const name = `adb connect ${target}`
      const args = ['connect', target]
      if (!quickCommands.value.some((c) => c.name === name)) {
        quickCommands.value.push({ name, args, group: 'adb' })
      }
      // 别名写入内存字典（serial 即 ip:port），用作侧边栏与设备信息显示名
      const alias = connectAlias.value.trim()
      if (alias) deviceAlias[target] = alias
      saveCfg()
      connectOpen.value = false
      // 连接成功后自动开始采集：先解除隐藏并刷新设备列表，再切 tab 启动
      clearHiddenSerial(target)
      await refreshDevices()
      autoStartLogcatOnConnect(target)
    }
  } catch (e) {
    if (attempt.cancelled) {
      // 用户主动取消：异常由强杀引起，静默（提示已在 cancelConnect 给过）
    } else if (e && e.message === 'CONNECT_TIMEOUT') {
      await abortConnect(attempt.runId, target, true)   // 超时也强杀，避免挂死的 adb 残留
      connectTimedOut.value = true
      toast(t('toast.connectTimeoutPrefix') + (CONNECT_TIMEOUT_MS / 1000) + t('toast.connectTimeoutSuffix'))
    } else {
      toast(t('toast.connectError') + (e && e.message ? e.message : e))
    }
  } finally {
    if (timer) clearTimeout(timer)
    // 若已取消且用户又发起新连接，不能让旧请求把新请求的 connecting 清掉
    if (activeConnect === attempt) { activeConnect = null; connecting.value = false }
  }
}

function openDeviceMenu(d, ev) {
  deviceCtxMenu.serial = d.serial
  deviceCtxMenu.x = ev.clientX
  deviceCtxMenu.y = ev.clientY
  deviceCtxMenu.open = true
}

function closeDeviceCtxMenu() { deviceCtxMenu.open = false }

function parseSerial(serial) {
  if (serial && serial.includes(':')) {
    const i = serial.lastIndexOf(':')
    return { ip: serial.slice(0, i), port: serial.slice(i + 1) }
  }
  return { ip: '', port: '' }
}

async function ctxSaveDevice() {
  const serial = deviceCtxMenu.serial
  closeDeviceCtxMenu()
  if (!serial) return
  const { ip, port } = parseSerial(serial)
  const content = JSON.stringify({ ip, port, name: displayName(serial), alias: deviceAlias[serial] || '' }, null, 2)
  try {
    const p = await api.invoke('file:saveText', { content, defaultPath: 'device-connection.json', filters: [{ name: t('modal.deviceConnection'), extensions: ['json'] }] })
    if (p) toast(t('toast.connectionSaved') + p)
  } catch (e) { toast(t('toast.saveFailed') + e.message) }
}

function ctxRenameDevice() {
  const serial = deviceCtxMenu.serial
  closeDeviceCtxMenu()
  if (!serial) return
  renameSerial.value = serial
  renameValue.value = deviceAlias[serial] || ''
  renameOpen.value = true
}

function confirmRenameDevice() {
  const serial = renameSerial.value
  if (serial) deviceAlias[serial] = renameValue.value.trim()
  renameOpen.value = false
}

export function useDevices() {

  return { adbDevices, adbDisconnectAll, adbKillServer, applyConnectHistory, cancelConnect, closeDeviceCtxMenu, collapseAll, confirmConnect, confirmRenameDevice, ctxRenameDevice, ctxSaveDevice, devInvoke, disconnectDevice, displayName, expandAll, openConnectModal, openDeviceMenu, parseSerial, reconnectDevice, refreshDevices, removeDeviceFromView, runAction, selectDevice, toggleDeviceLogcat, toggleGroup }
}
export { adbDevices, adbDisconnectAll, adbKillServer, applyConnectHistory, cancelConnect, closeDeviceCtxMenu, collapseAll, confirmConnect, confirmRenameDevice, ctxRenameDevice, ctxSaveDevice, devInvoke, disconnectDevice, displayName, expandAll, openConnectModal, openDeviceMenu, parseSerial, reconnectDevice, refreshDevices, removeDeviceFromView, runAction, selectDevice, toggleDeviceLogcat, toggleGroup }