// 共享状态：设备信息与检测（主 Tab / 信息卡 / 四个轮询列表 / getprop / 组件调试·权限·文件·重启·Monkey 弹窗）
import { ref, reactive, computed } from 'vue'
import { selectedSerial } from './devices.js'

export const activeMainTab = ref('log')

// ---------- 设备信息卡 ----------
export const deviceInfo = ref({})

export const deviceInfoLoading = ref(false)

export const dumpsysService = ref('')

export const dumpsysOut = ref('')

// ---------- 四个轮询列表（Service / 进程 / 线程 / 前台Activity） ----------
export const serviceList = ref([])

export const serviceLoading = ref(false)

export const processList = ref([])

export const processLoading = ref(false)

export const threadList = ref([])

export const threadLoading = ref(false)

export const activityList = ref([])

export const activityLoading = ref(false)

export const activityResumed = ref('')

export const serviceFilter = ref('')

export const serviceAuto = ref(false)

export const serviceInterval = ref(5)

export const processFilter = ref('')

export const processAuto = ref(false)

export const processInterval = ref(5)

export const threadFilter = ref('')

export const threadAuto = ref(false)

export const threadInterval = ref(5)

export const activityFilter = ref('')

export const activityAuto = ref(false)

export const activityInterval = ref(5)

export const serviceRunning = ref(false)

export const processRunning = ref(false)

export const threadRunning = ref(false)

export const activityRunning = ref(false)

// ---------- getprop ----------
export const getpropList = ref([])

export const getpropLoading = ref(false)

export const getpropFilter = ref('')

// ---------- 进程/线程 CPU 采样基准 ----------
export const procCpus = ref(1)

export const procPrev = Object.create(null)

export const threadPrev = Object.create(null)

export const clearPrev = () => { for (const k in procPrev) delete procPrev[k]; for (const k in threadPrev) delete threadPrev[k] }

export const serviceListFiltered = computed(() => {
  const q = serviceFilter.value.trim().toLowerCase()
  if (!q) return serviceList.value
  return serviceList.value.filter((s) => s.toLowerCase().includes(q))
})

export const processListFiltered = computed(() => {
  const q = processFilter.value.trim().toLowerCase()
  if (!q) return processList.value
  return processList.value.filter((p) => (p.pid + ' ' + p.name + ' ' + (p.comm || '')).toLowerCase().includes(q))
})

export const threadListFiltered = computed(() => {
  const q = threadFilter.value.trim().toLowerCase()
  if (!q) return threadList.value
  return threadList.value.filter((t) => (t.user + ' ' + t.pid + ' ' + t.tid + ' ' + t.name).toLowerCase().includes(q))
})

export const activityListFiltered = computed(() => {
  const q = activityFilter.value.trim().toLowerCase()
  if (!q) return activityList.value
  return activityList.value.filter((a) => a.name.toLowerCase().includes(q))
})

export const getpropListFiltered = computed(() => {
  const q = getpropFilter.value.trim().toLowerCase()
  if (!q) return getpropList.value
  return getpropList.value.filter((p) => (p.key + ' ' + p.value).toLowerCase().includes(q))
})

// 注：四个列表的自动刷新定时器句柄由 createPollingList 工厂闭包持有（见 useDeviceinfo.js），不再放 state 层。

// ---------- 组件调试弹窗（启动 Activity / Service / 广播） ----------
export const actModalOpen = ref(false)

export const actModalType = ref('activity')   // activity | startService | stopService | broadcast

export const actPkg = ref('')

export const actActivity = ref('')

export const actAction = ref('')

export const actService = ref('')

export const actServiceBackground = ref(true)   // 是否后台 service（默认后台；取消则以前台 service 启动）

export const actComponent = ref('')

export const actFlags = ref('')

export const actExtras = ref([{ type: 'es', key: '', value: '' }])

// 各类型独立的参数存储：activity / startService / stopService / broadcast 各自保存上次填入的参数，
// 打开对应窗口时只回填本类型的参数，避免互相污染（启动 Activity 的参数不会出现在 Service 窗口）。
export const actForms = reactive({
  activity: { pkg: '', activity: '', action: '', extras: [{ type: 'es', key: '', value: '' }] },
  startService: { pkg: '', service: '', serviceBackground: true, extras: [{ type: 'es', key: '', value: '' }] },
  stopService: { pkg: '', service: '', extras: [{ type: 'es', key: '', value: '' }] },
  broadcast: { pkg: '', action: '', component: '', flags: '', extras: [{ type: 'es', key: '', value: '' }] },
})

export const EXTRA_PREVIEW_FLAG = { es: '--es', ei: '--ei', ez: '--ez', ef: '--ef', el: '--el' }

export const actCmdPreview = computed(() => {
  const ser = selectedSerial.value || '<serial>'
  const base = `adb.exe -s ${ser} shell am`
  if (actModalType.value === 'activity') {
    const parts = [base, 'start']
    if (actAction.value && actAction.value.trim()) parts.push('-a', actAction.value.trim())
    else if (actPkg.value && actActivity.value) parts.push('-n', `${actPkg.value}/${actActivity.value}`)
    else return '（请填写 Action，或 包名 + Activity 类名）'
    for (const e of actExtras.value) if (e && e.key) parts.push(EXTRA_PREVIEW_FLAG[e.type] || '--es', e.key, String(e.value))
    return parts.join(' ')
  }
  if (actModalType.value === 'startService') {
    if (!actPkg.value || !actService.value) return '（请填写 包名 + Service 类名）'
    const cmd = actServiceBackground.value ? 'startservice' : 'start-foreground-service'
    const parts = [`adb.exe -s ${ser} shell am ${cmd} -n ${actPkg.value}/${actService.value}`]
    for (const e of actExtras.value) if (e && e.key) parts.push(EXTRA_PREVIEW_FLAG[e.type] || '--es', e.key, String(e.value))
    return parts.join(' ')
  }
  if (actModalType.value === 'stopService') {
    if (!actPkg.value || !actService.value) return '（请填写 包名 + Service 类名）'
    return `adb.exe -s ${ser} shell am stopservice -n ${actPkg.value}/${actService.value}`
  }
  if (!actAction.value) return '（请填写 Action）'
  const parts = [base, 'broadcast', '-a', actAction.value.trim()]
  let comp = actComponent.value.trim()
  if (comp && comp.startsWith('.') && actPkg.value.trim()) comp = actPkg.value.trim() + '/' + comp
  if (comp) parts.push('-n', comp)
  for (const e of actExtras.value) if (e && e.key) parts.push(EXTRA_PREVIEW_FLAG[e.type] || '--es', e.key, String(e.value))
  if (actFlags.value && actFlags.value.trim()) parts.push('-f', actFlags.value.trim())
  return parts.join(' ')
})

// ---------- 权限弹窗 ----------
export const permModalOpen = ref(false)

export const permMode = ref('grant')

export const permPkg = ref('')

export const permName = ref('')

// ---------- 文件推送/拉取弹窗 ----------
export const fileModalOpen = ref(false)

export const fileModalMode = ref('push')

export const fileLocal = ref('')

export const fileRemote = ref('')

// ---------- 重启弹窗 ----------
export const rebootModalOpen = ref(false)

export const rebootMode = ref('')

// ---------- Monkey 弹窗 ----------
export const monkeyModalOpen = ref(false)

export const monkeyPkg = ref('')

export const monkeySeed = ref('')

export const monkeyThrottle = ref('')

export const monkeyCount = ref('1000')

// ---------- 安装/卸载弹窗 ----------
export const installModalOpen = ref(false)

export const installOpts = reactive({ d: false, g: false, t: false })

export const uninstallModalOpen = ref(false)

export const uninstallKeep = ref(false)
