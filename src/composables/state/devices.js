// 共享状态：设备与连接（设备列表 / 选中设备 / 连接弹窗 / 别名与重命名 / 侧边栏操作分组）
import { ref, reactive } from 'vue'
import { api, lastMsg } from './core.js'
import { sanitizeSerial } from '../shared.js'

export const devices = ref([])

// 操作目标设备（应用/媒体/输入等操作作用于它）
export const selectedSerial = ref('')

// 当前正在查看日志的设备（日志 tab）
export const activeLogSerial = ref('')

export const refreshing = ref(false)

// 侧边栏「应用包名」，应用操作的目标包
export const appPkg = ref('')

export const groupOpen = reactive({ app: true, pkgops: true, media: true, netcap: true, input: true, perm: true, file: true, other: true })

export const devGroups = [
  { key: 'pkgops', title: '包名操作', items: [
    { kind: 'pkg' },
    { label: '加载包名', act: 'loadPkg', needProc: true },
    { label: '启动应用', act: 'appStart', needPkg: true },
    { label: '停止应用', act: 'appStop', needPkg: true },
    { label: '重启应用', act: 'appRestart', needPkg: true },
    { label: '清除缓存', act: 'appClear', needPkg: true },
    { label: '清除缓存并重启', act: 'appClearRestart', needPkg: true },
    { label: '卸载', act: 'appUninstall', needPkg: true, danger: true },
    { label: 'Monkey测试', act: 'monkey', needPkg: true }
  ]},
  { key: 'app', title: '应用操作', items: [
    { label: '启动Activity', act: 'actActivity' },
    { label: '启动Service', act: 'actStartService' },
    { label: '停止Service', act: 'actStopService' },
    { label: '发送广播', act: 'actBroadcast' }
  ]},
  { key: 'media', title: '媒体操作', items: [
    { label: '截图', act: 'screenshot' },
    { label: '截图到路径', act: 'screenshotToPath' },
    { label: '开始截图', act: 'screenshotTimer' },
    { label: '开始录屏', act: 'recordStart' }
  ]},
  { key: 'netcap', title: '网络抓包', items: [
    { label: '开始抓包', act: 'captureToggle' },
    { label: '抓包管理', act: 'captureManager' }
  ]},
  { key: 'input', title: '输入操作', items: [
    { label: '输入文本', act: 'inputText' },
    { label: '模拟按键', act: 'inputKey' },
    { label: '模拟点击', act: 'inputTap' },
    { label: '模拟滑动', act: 'inputSwipe' }
  ]},
  { key: 'perm', title: '权限操作', items: [
    { label: '授予权限(Beta)', act: 'grant' },
    { label: '撤销权限(Beta)', act: 'revoke', danger: true }
  ]},
  { key: 'file', title: '文件操作', items: [
    { label: '推送文件', act: 'pushFile' },
    { label: '拉取文件', act: 'pullFile' }
  ]},
  { key: 'other', title: '设备操作', items: [
    { label: '安装APK', act: 'installApk' },
    { label: '解析已装APK', act: 'parseInstalled' },
    { label: '清除设备缓存(Beta)', act: 'clearDeviceCache' },
    { label: '重启设备', act: 'reboot', danger: true },
    { label: 'root', act: 'root' },
    { label: 'unroot', act: 'unroot' },
    { label: 'remount', act: 'remount' },
    { label: 'adb devices', act: 'adbDevices', server: true },
    { label: 'adb disconnect', act: 'adbDisconnectAll', server: true },
    { label: 'adb kill-server', act: 'adbKillServer', server: true, danger: true }
  ]}
]

export const connectOpen = ref(false)

export const connectIp = ref('')

export const connectPort = ref('5555')

// 连接弹窗的别名输入（可选）；非空且连接成功则作为该设备显示名
export const connectAlias = ref('')

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

// 面向当前选中设备的通用 adb 调用：附带 serial，成功/失败写入状态栏消息
export async function devInvoke(label, channel, payload) {
  if (!selectedSerial.value) { lastMsg.value = '未选择设备'; return }
  try {
    const r = await api.invoke(channel, { serial: selectedSerial.value, ...payload })
    lastMsg.value = (r.code === 0 ? '完成：' : '失败：') + label + (r.code === 0 ? '' : (' ' + (r.err || r.code)))
  } catch (e) {
    lastMsg.value = label + '异常：' + e.message
  }
}
