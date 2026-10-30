// 设备信息与检测：信息卡导出、dumpsys/bugreport、四个轮询列表（经 createPollingList 工厂接线）、组件调试弹窗
import { watch, onBeforeUnmount } from 'vue'
import {actAction, actActivity, actCmdPreview, actComponent, actExtras, actFlags, actForms, actModalOpen, actModalType, actPkg, actService, actServiceBackground, activeMainTab, activityAuto, activityInterval, activityList, activityLoading, activityResumed, activityRunning, api, cfg, clearPrev, deviceInfo, deviceInfoLoading, dumpsysOut, dumpsysService, exportTs, getpropList, getpropLoading, lastMsg, procCpus, procPrev, processAuto, processInterval, processList, processLoading, processRunning, deviceLabel, devInvoke, selectedSerial, serviceAuto, serviceInterval, serviceList, serviceLoading, serviceRunning, threadAuto, threadInterval, threadList, threadLoading, threadPrev, threadRunning} from './state'
import { createPollingList } from './createPollingList'

import { toast } from './useUi'


async function fetchDeviceInfo() {
  if (!selectedSerial.value) return
  deviceInfoLoading.value = true
  try {
    deviceInfo.value = await api.invoke('adb:deviceInfo', { serial: selectedSerial.value })
  } catch (e) {
    lastMsg.value = '获取设备信息失败：' + e.message
  } finally {
    deviceInfoLoading.value = false
  }
}

async function exportDeviceInfo() {
  if (deviceInfoLoading.value) return
  const d = deviceInfo.value || {}
  if (!Object.keys(d).length) { lastMsg.value = '暂无设备信息，请先刷新'; return }
  const serial = selectedSerial.value || 'unknown'
  const lines = ['设备信息（序列号: ' + serial + '）']
  lines.push('型号: ' + (d.model || '—'))
  lines.push('Android 版本: ' + (d.androidVersion || '—'))
  lines.push('分辨率: ' + (d.resolution || '—'))
  lines.push('密度: ' + (d.density || '—'))
  lines.push('内存(总量): ' + (d.memTotal || '—'))
  lines.push('内存(可用): ' + (d.memAvailable || '—'))
  lines.push('存储(可用/总量): ' + (d.storage || '—'))
  lines.push('CPU: ' + (d.cpu || '—'))
  lines.push('android_id: ' + (d.androidId || '—'))
  lines.push('stbid: ' + (d.stbId || '—'))
  lines.push('oid: ' + (d.oid || '—'))
  lines.push('前台 Activity: ' + (d.foregroundActivity || '—'))
  lines.push('MAC（多网卡）:')
  const macs = d.macs || []
  if (macs.length) macs.forEach((m) => lines.push('  ' + m))
  else lines.push('  —')
  const content = lines.join('\n')
  const ts = exportTs()
  const defaultPath = (cfg.value.outDir || '') + '/deviceinfo_' + deviceLabel(serial) + '_' + ts + '.txt'
  const path = await api.invoke('file:saveText', { content, defaultPath, filters: [{ name: 'Text', extensions: ['txt'] }] })
  if (path) lastMsg.value = '已导出：' + path
}

async function fetchServices(silent = false) {
  if (!selectedSerial.value) return
  if (!silent) serviceLoading.value = true
  try {
    const r = await api.invoke('adb:services', { serial: selectedSerial.value })
    serviceList.value = r.code === 0 ? (r.list || []) : []
    if (r.code !== 0) lastMsg.value = '获取 Service 失败：' + (r.err || r.code)
  } catch (e) { serviceList.value = []; lastMsg.value = '获取 Service 异常：' + e.message }
  finally { if (!silent) serviceLoading.value = false }
}

async function fetchProcesses(silent = false) {
  if (!selectedSerial.value) return
  if (!silent) processLoading.value = true
  try {
    const r = await api.invoke('adb:psStat', { serial: selectedSerial.value })
    if (r.code !== 0) { lastMsg.value = '获取进程失败：' + (r.err || r.code); processList.value = []; return }
    procCpus.value = r.cpus || 1
    const now = Date.now()
    processList.value = (r.list || []).map((p) => {
      const j = p.utime + p.stime
      let cpu = 0
      const prev = procPrev[p.pid]
      if (prev) { const dt = (now - prev.t) / 1000; if (dt > 0) cpu = (j - prev.j) / (dt * procCpus.value) }
      procPrev[p.pid] = { j, t: now }
      return { ...p, cpu: Math.max(0, Math.min(999, cpu)) }
    })
  } catch (e) { processList.value = []; lastMsg.value = '获取进程异常：' + e.message }
  finally { if (!silent) processLoading.value = false }
}

async function fetchThreads(silent = false) {
  if (!selectedSerial.value) return
  if (!silent) threadLoading.value = true
  try {
    const [tr, sr] = await Promise.all([
      api.invoke('adb:threads', { serial: selectedSerial.value }),
      api.invoke('adb:threadStat', { serial: selectedSerial.value }),
    ])
    if (tr.code !== 0) { lastMsg.value = '获取线程失败：' + (tr.err || tr.code); threadList.value = []; return }
    if (sr.cpus) procCpus.value = sr.cpus
    const map = sr.list || {}
    const now = Date.now()
    threadList.value = (tr.list || []).map((t) => {
      const st = map[t.pid + '-' + t.tid]
      let cpu = 0
      if (st) {
        const j = st.utime + st.stime
        const prev = threadPrev[t.pid + '-' + t.tid]
        if (prev) { const dt = (now - prev.t) / 1000; if (dt > 0) cpu = (j - prev.j) / (dt * procCpus.value) }
        threadPrev[t.pid + '-' + t.tid] = { j, t: now }
      }
      return { ...t, cpu: Math.max(0, Math.min(999, cpu)) }
    })
  } catch (e) { threadList.value = []; lastMsg.value = '获取线程异常：' + e.message }
  finally { if (!silent) threadLoading.value = false }
}

async function fetchActivities(silent = false) {
  if (!selectedSerial.value) return
  if (!silent) activityLoading.value = true
  try {
    const r = await api.invoke('adb:activities', { serial: selectedSerial.value })
    if (r.code !== 0) { lastMsg.value = '获取前台 Activity 失败：' + (r.err || r.code); activityList.value = []; return }
    activityResumed.value = r.resumed || ''
    activityList.value = (r.list || []).map((a) => ({ name: a, foreground: a === activityResumed.value }))
  } catch (e) { activityList.value = []; lastMsg.value = '获取前台 Activity 异常：' + e.message }
  finally { if (!silent) activityLoading.value = false }
}

async function fetchGetprop(silent = false) {
  if (!selectedSerial.value) return
  if (!silent) getpropLoading.value = true
  try {
    const r = await api.invoke('adb:getprop', { serial: selectedSerial.value })
    if (r.code !== 0) { lastMsg.value = '获取 getprop 失败：' + (r.err || r.code); getpropList.value = []; return }
    getpropList.value = r.list || []
  } catch (e) { getpropList.value = []; lastMsg.value = '获取 getprop 异常：' + e.message }
  finally { if (!silent) getpropLoading.value = false }
}

async function exportGetprop() {
  if (getpropLoading.value) return
  const list = getpropList.value || []
  if (!list.length) { lastMsg.value = '暂无 getprop 数据，请先刷新'; return }
  const content = list.map((p) => '[' + p.key + ']: [' + (p.value || '') + ']').join('\n')
  const ts = exportTs()
  const serial = selectedSerial.value || 'unknown'
  const defaultPath = (cfg.value.outDir || '') + '/getprop_' + deviceLabel(serial) + '_' + ts + '.txt'
  const path = await api.invoke('file:saveText', { content, defaultPath, filters: [{ name: 'Text', extensions: ['txt'] }] })
  if (path) lastMsg.value = '已导出：' + path
}

async function runDumpsys() {
  if (!selectedSerial.value || !dumpsysService.value.trim()) { toast('请输入 service'); return }
  try {
    const r = await api.invoke('adb:dumpsys', { serial: selectedSerial.value, service: dumpsysService.value.trim() })
    dumpsysOut.value = (r.code === 0 ? '' : '[exit ' + r.code + ']\n') + r.out + r.err
  } catch (e) { dumpsysOut.value = '执行失败：' + e.message }
}

async function runBugreport() {
  if (!selectedSerial.value) { toast('请先选择设备'); return }
  const dir = await api.invoke('file:pickDir', { defaultPath: cfg.value.outDir || undefined })
  if (!dir) return
  try {
    const r = await api.invoke('adb:bugreport', { serial: selectedSerial.value, outDir: dir })
    lastMsg.value = r.code === 0 ? 'bugreport 已保存：' + (r.path || dir) : 'bugreport 失败：' + (r.err || r.code)
  } catch (e) { lastMsg.value = 'bugreport 异常：' + e.message }
}

// 四个轮询列表：状态 ref 在 state 层，启停/刷新/自动刷新定时器由工厂统一接线
const lists = {
  service: createPollingList({ key: 'service', list: serviceList, running: serviceRunning, auto: serviceAuto, interval: serviceInterval, fetch: fetchServices }),
  process: createPollingList({ key: 'process', list: processList, running: processRunning, auto: processAuto, interval: processInterval, fetch: fetchProcesses, kickMs: 1200, onStop: clearPrev }),
  thread: createPollingList({ key: 'thread', list: threadList, running: threadRunning, auto: threadAuto, interval: threadInterval, fetch: fetchThreads, kickMs: 1200, onStop: clearPrev }),
  activity: createPollingList({ key: 'activity', list: activityList, running: activityRunning, auto: activityAuto, interval: activityInterval, fetch: fetchActivities, onStop: () => { activityResumed.value = '' } }),
}

function toggleDetect(tab) {
  if (!selectedSerial.value) { toast('请先选择设备'); return }
  lists[tab]?.toggle()
  syncAutoTimers()
}

function manualRefresh(tab) {
  if (!selectedSerial.value) { toast('请先选择设备'); return }
  lists[tab]?.refresh()
}

function syncAutoTimers() {
  for (const l of Object.values(lists)) l.syncAuto(activeMainTab, selectedSerial)
}

function addExtra() { actExtras.value.push({ type: 'es', key: '', value: '' }) }

function removeExtra(i) { actExtras.value.splice(i, 1) }

function openActModal(type) {
  const f = actForms[type] || actForms.activity
  actPkg.value = f.pkg || ''
  actActivity.value = f.activity || ''
  actAction.value = f.action || ''
  actService.value = f.service || ''
  actServiceBackground.value = f.serviceBackground !== false
  actComponent.value = f.component || ''
  actFlags.value = f.flags || ''
  actExtras.value = (f.extras && f.extras.length) ? f.extras.map((e) => ({ ...e })) : [{ type: 'es', key: '', value: '' }]
  actModalType.value = type
  actModalOpen.value = true
}

function closeActModal() {
  const f = actForms[actModalType.value]
  if (f) {
    f.pkg = actPkg.value
    f.activity = actActivity.value
    f.action = actAction.value
    f.service = actService.value
    f.serviceBackground = actServiceBackground.value
    f.component = actComponent.value
    f.flags = actFlags.value
    f.extras = actExtras.value.map((e) => ({ ...e }))
  }
  actModalOpen.value = false
}

async function runActActivity() {
  if (!selectedSerial.value) { toast('请先选择设备'); return }
  if (!actAction.value.trim() && !(actPkg.value && actActivity.value)) { toast('请填写 Action，或 包名 + Activity 类名'); return }
  const extras = actExtras.value.filter((e) => e.key).map((e) => ({ type: e.type, key: e.key, value: e.value }))
  await devInvoke('启动Activity', 'adb:amStart', { pkg: actPkg.value, activity: actActivity.value, action: actAction.value, extras })
  closeActModal()
}

async function runActService(mode) {
  if (!selectedSerial.value) { toast('请先选择设备'); return }
  if (!actPkg.value || !actService.value) { toast('请填写 包名 + Service 类名'); return }
  if (mode === 'start') {
    const extras = actExtras.value.filter((e) => e.key).map((e) => ({ type: e.type, key: e.key, value: e.value }))
    await devInvoke('启动Service', 'adb:startService', { pkg: actPkg.value, service: actService.value, foreground: !actServiceBackground.value, extras })
  } else {
    await devInvoke('停止Service', 'adb:stopService', { pkg: actPkg.value, service: actService.value })
  }
  closeActModal()
}

async function runActBroadcast() {
  if (!selectedSerial.value) { toast('请先选择设备'); return }
  if (!actAction.value) { toast('请填写 Action'); return }
  let component = actComponent.value.trim()
  if (component && component.startsWith('.')) {
    if (!actPkg.value.trim()) { toast('目标组件为相对类名，请先填写包名，或改用 包名/类名 完整格式'); return }
    component = actPkg.value.trim() + '/' + component
  }
  const extras = actExtras.value.filter((e) => e.key).map((e) => ({ type: e.type, key: e.key, value: e.value }))
  await devInvoke('发送广播', 'adb:broadcast', { action: actAction.value, component, extras, flags: actFlags.value })
  closeActModal()
}

async function saveActCfg() {
  const data = {
    type: actModalType.value,
    actPkg: actPkg.value, actActivity: actActivity.value, actAction: actAction.value,
    actService: actService.value, actServiceBackground: actServiceBackground.value,
    actComponent: actComponent.value, actFlags: actFlags.value,
    actExtras: JSON.parse(JSON.stringify(actExtras.value))
  }
  try {
    const p = await api.invoke('file:saveText', {
      content: JSON.stringify(data, null, 2),
      defaultPath: `组件配置_${actModalType.value}.json`,
      filters: [{ name: 'JSON 配置', extensions: ['json'] }]
    })
    if (!p) { toast('已取消保存'); return }
    toast('已保存：' + p)
  } catch (e) { toast('保存失败：' + e.message) }
}

async function loadActCfg() {
  try {
    const p = await api.invoke('file:openFile', { filters: [{ name: 'JSON 配置', extensions: ['json'] }] })
    if (!p) { toast('已取消加载'); return }
    const d = JSON.parse(await api.invoke('file:readText', { path: p }))
    actPkg.value = d.actPkg || ''
    actActivity.value = d.actActivity || ''
    actAction.value = d.actAction || ''
    actService.value = d.actService || ''
    actServiceBackground.value = d.actServiceBackground !== false
    actComponent.value = d.actComponent || ''
    actFlags.value = d.actFlags || ''
    actExtras.value = (d.actExtras && d.actExtras.length) ? d.actExtras : [{ type: 'es', key: '', value: '' }]
    toast('已加载：' + p)
  } catch (e) { toast('加载失败：' + e.message) }
}

async function copyActCmd() {
  try { await api.invoke('clipboard:write', { text: actCmdPreview.value }); toast('已复制 adb 命令') }
  catch { toast('复制失败') }
}

export function useDeviceinfo() {
watch(activeMainTab, (t) => {
  if (!selectedSerial.value) return
  if (t === 'info') fetchDeviceInfo()
  else if (t === 'getprop') fetchGetprop()
  else lists[t]?.refreshIfRunning()
})
watch(selectedSerial, () => {
  clearPrev() // 换设备后 CPU 采样基准失效，清空重算
  if (activeMainTab.value === 'info') fetchDeviceInfo()
  else if (activeMainTab.value === 'getprop') fetchGetprop()
  else lists[activeMainTab.value]?.refreshIfRunning()
})
watch([serviceAuto, serviceInterval, processAuto, processInterval, threadAuto, threadInterval, activityAuto, activityInterval, activeMainTab, selectedSerial], syncAutoTimers)
onBeforeUnmount(() => { for (const l of Object.values(lists)) l.dispose() })

  return { addExtra, closeActModal, copyActCmd, exportDeviceInfo, exportGetprop, fetchActivities, fetchDeviceInfo, fetchGetprop, fetchProcesses, fetchServices, fetchThreads, loadActCfg, manualRefresh, openActModal, removeExtra, runActActivity, runActBroadcast, runActService, runBugreport, runDumpsys, saveActCfg, syncAutoTimers, toggleDetect }
}
export { addExtra, closeActModal, copyActCmd, exportDeviceInfo, exportGetprop, fetchActivities, fetchDeviceInfo, fetchGetprop, fetchProcesses, fetchServices, fetchThreads, loadActCfg, manualRefresh, openActModal, removeExtra, runActActivity, runActBroadcast, runActService, runBugreport, runDumpsys, saveActCfg, syncAutoTimers, toggleDetect }