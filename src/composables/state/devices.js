// 共享状态：设备与连接（设备列表 / 选中设备 / 连接弹窗 / 别名与重命名 / 侧边栏操作分组）
import { ref, reactive } from 'vue'
import { t } from '@/i18n'
import { api } from './core.js'
import { cmdDetail, sanitizeSerial } from '../shared.js'
import { showResult } from './result.js'

export const devices = ref([])

// 操作目标设备（应用/媒体/输入等操作作用于它）
export const selectedSerial = ref('')

// 当前正在查看日志的设备（日志 tab）
export const activeLogSerial = ref('')

export const refreshing = ref(false)

// 侧边栏「应用包名」，应用操作的目标包
export const appPkg = ref('')

export const groupOpen = reactive({ app: true, pkgops: true, media: true, netcap: true, input: true, perm: true, file: true, other: true })

// icon 为 action-icons.js 中的线性 SVG 名称；modal 表示点击后先弹窗填参数；danger 表示高危（优先级高于 modal）。
// 三者共同决定按钮右侧的行为标记：直接执行 / 弹窗 / 高危。
export const devGroups = [
  { key: 'pkgops', titleKey: 'group.pkgops', items: [
    { kind: 'pkg' },
    { labelKey: 'action.loadPkg', act: 'loadPkg', needProc: true, icon: 'search' },
    { labelKey: 'action.appStart', act: 'appStart', needPkg: true, icon: 'play' },
    { labelKey: 'action.appStop', act: 'appStop', needPkg: true, icon: 'square' },
    { labelKey: 'action.procKill', act: 'procKill', needPkg: true, icon: 'kill' },
    { labelKey: 'action.appRestart', act: 'appRestart', needPkg: true, icon: 'restart' },
    { labelKey: 'action.appClear', act: 'appClear', needPkg: true, icon: 'clear' },
    { labelKey: 'action.appClearRestart', act: 'appClearRestart', needPkg: true, icon: 'clearRestart' },
    { labelKey: 'action.uninstall', act: 'appUninstall', needPkg: true, danger: true, modal: true, icon: 'trash' },
    { labelKey: 'action.monkey', act: 'monkey', needPkg: true, modal: true, icon: 'flask' }
  ]},
  { key: 'app', titleKey: 'group.app', items: [
    { labelKey: 'action.actActivity', act: 'actActivity', modal: true, icon: 'window' },
    { labelKey: 'action.actStartService', act: 'actStartService', modal: true, icon: 'cog' },
    { labelKey: 'action.actStopService', act: 'actStopService', modal: true, icon: 'squareX' },
    { labelKey: 'action.actBroadcast', act: 'actBroadcast', modal: true, icon: 'radio' }
  ]},
  { key: 'media', titleKey: 'group.media', items: [
    { labelKey: 'action.screenshot', act: 'screenshot', icon: 'camera' },
    { labelKey: 'action.screenshotToPath', act: 'screenshotToPath', icon: 'save' },
    { labelKey: 'action.screenshotTimer', act: 'screenshotTimer', icon: 'timer' },
    { labelKey: 'action.recordStart', act: 'recordStart', icon: 'video' }
  ]},
  { key: 'netcap', titleKey: 'group.netcap', items: [
    { labelKey: 'action.captureToggle', act: 'captureToggle', icon: 'antenna' },
    { labelKey: 'action.captureManager', act: 'captureManager', modal: true, icon: 'list' }
  ]},
  { key: 'input', titleKey: 'group.input', items: [
    { labelKey: 'action.inputText', act: 'inputText', modal: true, icon: 'pencil' },
    { labelKey: 'action.inputKey', act: 'inputKey', modal: true, icon: 'keyboard' },
    { labelKey: 'action.inputTap', act: 'inputTap', modal: true, icon: 'tap' },
    { labelKey: 'action.inputSwipe', act: 'inputSwipe', modal: true, icon: 'swipe' }
  ]},
  { key: 'perm', titleKey: 'group.perm', items: [
    { labelKey: 'action.grant', act: 'grant', modal: true, icon: 'checkCircle' },
    { labelKey: 'action.revoke', act: 'revoke', danger: true, modal: true, icon: 'xCircle' }
  ]},
  { key: 'file', titleKey: 'group.file', items: [
    { labelKey: 'action.pushFile', act: 'pushFile', modal: true, icon: 'upload' },
    { labelKey: 'action.pullFile', act: 'pullFile', modal: true, icon: 'download' }
  ]},
  { key: 'other', titleKey: 'group.other', items: [
    { labelKey: 'action.installApk', act: 'installApk', modal: true, icon: 'package' },
    { labelKey: 'action.parseInstalled', act: 'parseInstalled', modal: true, icon: 'phone' },
    { labelKey: 'action.clearDeviceCache', act: 'clearDeviceCache', icon: 'sparkles' },
    { labelKey: 'action.reboot', act: 'reboot', danger: true, modal: true, icon: 'power' },
    { label: 'root', act: 'root', icon: 'key' },
    { label: 'unroot', act: 'unroot', icon: 'lock' },
    { label: 'remount', act: 'remount', icon: 'drive' },
    { label: 'adb devices', act: 'adbDevices', server: true, icon: 'monitor' },
    { label: 'adb disconnect', act: 'adbDisconnectAll', server: true, icon: 'unplug' },
    { label: 'adb kill-server', act: 'adbKillServer', server: true, danger: true, icon: 'kill' }
  ]}
]

export const connectOpen = ref(false)

export const connectIp = ref('')

export const connectPort = ref('5555')

// 连接弹窗的别名输入（可选）；非空且连接成功则作为该设备显示名
export const connectAlias = ref('')

// 连接弹窗「历史」下拉当前选中项，值为 `${ip}:${port}`（唯一键），选中并回填后立即清空以支持重复选择同一项
export const connectHistorySel = ref('')

// adb connect 请求期间：保持弹窗打开并展示进度；超时后置 connectTimedOut 给明确提示
export const connecting = ref(false)
export const connectTimedOut = ref(false)
// adb connect 正常 1~3 秒返回；挂起时不能让渲染层无限 await。渲染文案与此共用同一常量。
export const CONNECT_TIMEOUT_MS = 15000

// 设备别名：serial->别名（仅当前会话，不持久化）；连接成功或右键「重命名」时写入
export const deviceAlias = reactive({})

export const deviceCtxMenu = reactive({ open: false, x: 0, y: 0, serial: '' })

export const renameOpen = ref(false)

export const renameSerial = ref('')

export const renameValue = ref('')

// 设备友好名（日志/导出文件名区分多设备）：优先取 adb devices -l 的 model 字段（设备列表 info 已带），
// 取不到回落 serial；二者都 sanitize，serial 始终保留，保证两台同型号也不撞名。
export function deviceLabel(serial) {
  let model = ''
  const d = devices.value.find((x) => x.serial === serial)
  if (d && d.info) {
    const mm = /\bmodel:(\S+)/.exec(d.info)
    if (mm) model = sanitizeSerial(mm[1])
  }
  const s = sanitizeSerial(serial)
  return model ? model + '_' + s : s
}

// 面向当前选中设备的通用 adb 调用：附带 serial，成功/失败统一走结果弹窗（不再写状态栏）
export async function devInvoke(label, channel, payload) {
  if (!selectedSerial.value) { showResult(label, t('err.noDevice'), false); return }
  try {
    const r = await api.invoke(channel, { serial: selectedSerial.value, ...payload })
    const ok = r.code === 0
    const text = t(ok ? 'result.done' : 'result.failed', { label, err: r.err || r.code }) + '\n' + cmdDetail(r)
    showResult(label, text, ok)
  } catch (e) {
    showResult(label, t('result.error', { label, err: e.message }), false)
  }
}
