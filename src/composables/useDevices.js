// 由 split_app2.cjs 自动拆分生成（devices）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {activeLogSerial, api, appPkg, autoLogBufMap, autoLogMeta, capturing, connectAlias, connectIp, connectOpen, connectPort, devGroups, devInvoke, deviceAlias, deviceCtxMenu, devices, fileModalMode, fileModalOpen, groupOpen, keyModalOpen, lastMsg, logErrMap, logsMap, monkeyModalOpen, permModalOpen, permMode, procsMap, quickCommands, rebootModalOpen, recording, refreshing, renameOpen, renameSerial, renameValue, runningMap, screenshotting, selectedSerial} from './state'
import { ensureLogFilter, loadProcToPkg, refreshProcs, startLogcat, stopLogcat } from './useLogcat'
import { toast } from './useUi'
import { openActModal } from './useDeviceinfo'
import { openCmdModal, openInputModal, openInstallModal, openUninstallModal, resetFileForm } from './useActions'
import { openCaptureManager, screenshotToPath, startCapture, startRec, stopCapture, stopRec, takeScreenshot, toggleScreenshotTimer } from './useMedia'
import { installApk, parseInstalled, parseLocal } from './useApk'
import { saveCfg } from './useConfig'

async function refreshDevices() {
  if (refreshing.value) return   // 防止设备事件与定时器并发刷新叠加
  refreshing.value = true
  try {
    const list = await api.invoke('adb:devices')
    const newSerials = list.map((d) => d.serial)
    // 清理已移除设备的日志会话与缓存（停掉其 logcat，删映射，避免内存泄漏）
    for (const s of Object.keys(logsMap)) {
      if (!newSerials.includes(s)) {
        if (runningMap[s]) { try { api.send('logcat:stop', s) } catch {} }
        delete logsMap[s]; delete runningMap[s]; delete logErrMap[s]; delete procsMap[s]; delete autoLogBufMap[s]; delete autoLogMeta[s]
      }
    }
    for (const s of newSerials) { if (!logsMap[s]) logsMap[s] = []; ensureLogFilter(s) }
    devices.value = list
    if (!selectedSerial.value || !list.some((d) => d.serial === selectedSerial.value)) {
      selectedSerial.value = list[0]?.serial || ''
      activeLogSerial.value = selectedSerial.value
    }
    await refreshProcs(activeLogSerial.value)
  } catch (e) {
    devices.value = []
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
  if (runningMap[serial]) { try { api.send('logcat:stop', serial) } catch {} }
  delete logsMap[serial]; delete runningMap[serial]; delete logErrMap[serial]; delete procsMap[serial]; delete autoLogBufMap[serial]; delete autoLogMeta[serial]
  devices.value = devices.value.filter((d) => d.serial !== serial)
  if (selectedSerial.value === serial) selectedSerial.value = devices.value[0]?.serial || ''
  if (activeLogSerial.value === serial) activeLogSerial.value = selectedSerial.value
}

async function disconnectDevice(serial) {
  if (!serial) return
  const isNet = serial.includes(':')
  if (!isNet) toast('USB/本地设备已移出列表（仍物理连接，拔线后彻底移除）')
  removeDeviceFromView(serial)
  if (isNet) {
    try {
      const r = await api.invoke('adb:disconnect', { serial })
      if (r.code !== 0) toast('断开命令返回非零：' + (r.out || r.err || r.code))
    } catch (e) {
      // 主进程未注册该通道（如未重启即改了 main 进程代码）时，设备已从视图移除，仅提示命令未执行
      toast('断开命令未执行（设备已从列表移除）：' + e.message)
    }
  }
}

async function adbDevices() {
  try {
    const r = await api.invoke('adb:run', ['devices'])
    const body = `[exit ${r.code}]\n${r.out}${r.err}`
    openCmdModal('$ adb devices', body, `$ adb devices\n\n${body}`)
  } catch (e) { toast('执行失败：' + e.message) }
}

async function adbDisconnectAll() {
  try {
    const r = await api.invoke('adb:run', ['disconnect'])
    toast((r.code === 0 ? '已断开全部网络连接：' : '断开失败：') + (r.out || r.err || r.code))
    await refreshDevices()
  } catch (e) { toast('执行失败：' + e.message) }
}

async function adbKillServer() {
  try {
    const r = await api.invoke('adb:run', ['kill-server'])
    toast(r.code === 0 ? '已停止 adb 服务器' : '停止失败：' + (r.out || r.err || r.code))
    // 服务器停止后设备列表应清空；即便刷新因服务器未起而异常，也强制置空
    await refreshDevices().catch(() => { devices.value = [] })
  } catch (e) { toast('执行失败：' + e.message) }
}

function toggleGroup(k) { groupOpen[k] = !groupOpen[k] }

function expandAll() { for (const g of devGroups) groupOpen[g.key] = true }

function collapseAll() { for (const g of devGroups) groupOpen[g.key] = false }

function runAction(item) {
  const effLabel = (item.act === 'recordStart' && recording.value) ? '停止录屏'
    : (item.act === 'screenshotTimer' && screenshotting.value) ? '停止截图'
    : item.label
  toast('已点击：' + effLabel)
  if (item.needPkg && !appPkg.value) { lastMsg.value = '请先在侧边栏填写应用包名'; return }
  switch (item.act) {
    case 'appStart': return devInvoke('启动应用', 'adb:appStart', { pkg: appPkg.value })
    case 'appStop': return devInvoke('停止应用', 'adb:appStop', { pkg: appPkg.value })
    case 'appRestart': return devInvoke('重启应用', 'adb:appRestart', { pkg: appPkg.value })
    case 'appClear': return devInvoke('清除缓存', 'adb:appClear', { pkg: appPkg.value })
    case 'appClearRestart': return devInvoke('清除缓存并重启', 'adb:appClearRestart', { pkg: appPkg.value })
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
    case 'clearDeviceCache': return devInvoke('清除设备缓存', 'adb:clearDeviceCache', {})
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
    connectIp.value = ''
    connectPort.value = '5555'
    connectAlias.value = ''
  }
  connectOpen.value = true
}

async function confirmConnect() {
  const ip = connectIp.value.trim()
  const port = connectPort.value.trim() || '5555'
  if (!ip) { toast('请输入 IP'); return }
  connectOpen.value = false
  try {
    // 命令本身即 adb 参数，不再额外拼 "adb" 前缀
    const r = await api.invoke('adb:run', ['connect', `${ip}:${port}`])
    const msg = (r.code === 0 ? '已连接：' : '连接失败：') + (r.out || r.err || r.code)
    toast(msg)
    // 连接成功：把连接信息存为快捷命令（命令名为完整 adb 命令，分组 adb）
    if (r.code === 0) {
      const name = `adb connect ${ip}:${port}`
      const args = ['connect', `${ip}:${port}`]
      if (!quickCommands.value.some((c) => c.name === name)) {
        quickCommands.value.push({ name, args, group: 'adb' })
        saveCfg()
      }
      // 别名非空：关联到该设备（serial 即 ip:port），用作侧边栏与设备信息显示名
      const alias = connectAlias.value.trim()
      if (alias) deviceAlias[`${ip}:${port}`] = alias
    }
  } catch (e) {
    toast('连接异常：' + e.message)
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
    const p = await api.invoke('file:saveText', { content, defaultPath: 'device-connection.json', filters: [{ name: '设备连接', extensions: ['json'] }] })
    if (p) toast('已保存设备连接：' + p)
  } catch (e) { toast('保存失败：' + e.message) }
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

async function loadDeviceFromFile() {
  const p = await api.invoke('file:openFile', { filters: [{ name: '设备连接', extensions: ['json'] }] })
  if (!p) return
  try {
    const text = await api.invoke('file:readText', { path: p })
    const o = JSON.parse(text)
    if (typeof o !== 'object' || !o) throw new Error('文件格式不正确')
    openConnectModal({ ip: o.ip || '', port: o.port || '5555', alias: o.alias || '' })
    toast('已载入设备信息，确认即可连接')
  } catch (e) { toast('加载失败：' + e.message) }
}

export function useDevices() {

  return { adbDevices, adbDisconnectAll, adbKillServer, closeDeviceCtxMenu, collapseAll, confirmConnect, confirmRenameDevice, ctxRenameDevice, ctxSaveDevice, devInvoke, disconnectDevice, displayName, expandAll, loadDeviceFromFile, openConnectModal, openDeviceMenu, parseSerial, refreshDevices, removeDeviceFromView, runAction, selectDevice, toggleDeviceLogcat, toggleGroup }
}
export { adbDevices, adbDisconnectAll, adbKillServer, closeDeviceCtxMenu, collapseAll, confirmConnect, confirmRenameDevice, ctxRenameDevice, ctxSaveDevice, devInvoke, disconnectDevice, displayName, expandAll, loadDeviceFromFile, openConnectModal, openDeviceMenu, parseSerial, refreshDevices, removeDeviceFromView, runAction, selectDevice, toggleDeviceLogcat, toggleGroup }