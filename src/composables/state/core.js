// 共享状态：跨域基础（api 桥 / 配置 / 全局消息 / 窗口状态）+ 日志默认配色/字体常量
import { ref, computed } from 'vue'

export const api = window.api

// 日志级别默认色拆两套。旧 DEFAULT_LOG_COLORS 保留为浅色别名，兼容既有 import。
// I 级浅色为纯黑，深色底上不可读，故深色主题必须换浅色前景。
export const DEFAULT_LOG_COLORS_LIGHT = { V: '#CFC4C6', D: '#CFC4C6', I: '#000000', W: '#FFC0C0', E: '#FF0000', F: '#FF0000' }
export const DEFAULT_LOG_COLORS_DARK = { V: '#9aa1ab', D: '#b0b7c0', I: '#e6e8eb', W: '#ffc266', E: '#ff6b6b', F: '#ff6b6b' }
export const DEFAULT_LOG_COLORS = DEFAULT_LOG_COLORS_LIGHT

export const DEFAULT_LOG_COLOR_BOLD = { V: false, D: false, I: false, W: false, E: false, F: false }

export const DEFAULT_LOG_BG_COLORS_LIGHT = { V: '#FFFFFF', D: '#FFFFFF', I: '#FFFFFF', W: '#FFFFFF', E: '#FFFFFF', F: '#FFFFFF' }
export const DEFAULT_LOG_BG_COLORS_DARK = { V: '#22262d', D: '#22262d', I: '#22262d', W: '#22262d', E: '#22262d', F: '#22262d' }
export const DEFAULT_LOG_BG_COLORS = DEFAULT_LOG_BG_COLORS_LIGHT

export const DEFAULT_LOG_BG_ON = { V: false, D: false, I: false, W: false, E: false, F: false }

export const DEFAULT_LOG_FONT = { size: 12, family: '"Cascadia Code", Consolas, monospace', bold: false, lineHeight: 1.4 }

export const DEFAULT_FILTER_HISTORY_MAX = 20

// 过滤历史：tag = Tag 过滤，text = 关键字过滤；元素 { text, locked }，数组顺序即「最近在前」。
// 与 cfg 同域：cfg 是唯一持久化入口，历史随 config:save 一起落盘，不另开 IPC。
export const cfg = ref({ lang: '', theme: 'system', bgEnabled: false, bgImage: '', bgZones: { chrome: { enabled: false, color: '', alpha: 100 }, log: { enabled: false, color: '', alpha: 100 } }, keycodeLangMode: 'follow', quickCommands: [], lastSerial: '', hiddenSerials: [], outDir: '', targetPkg: '', configPath: '', autoLog: false, appLogEnabled: false, appLogDir: '', closeOnOuterClick: false, checkUpdateOnStartup: true, updateDismissedDate: '', cursorMoveNoScroll: true, logColors: { ...DEFAULT_LOG_COLORS }, logBgColors: { ...DEFAULT_LOG_BG_COLORS }, logBgOn: { ...DEFAULT_LOG_BG_ON }, logFont: { ...DEFAULT_LOG_FONT }, captureArgs: '-p -vv -s 0 -w', captureDeviceDir: '/sdcard/adbpp_captures/', captureLocalDir: '', captureAsRoot: false, screenshotDir: '', maxRender: 20000, filterHistoryMax: DEFAULT_FILTER_HISTORY_MAX, filterHistory: { tag: [], text: [] }, lastConnectIp: '', lastConnectPort: '5555', connectHistory: [], autoReconnect: true, autoReconnectInterval: 5, wheelDownLockBottom: true, screenshotInterval: 1000 })

// 过滤框「历史」下拉当前展开项：'' | 'tag' | 'text'（同一时刻只开一个）
export const filterHistoryOpen = ref('')

// 供过滤框下拉与设置面板共用的列表视图（computed 跟随 cfg 持久化数据，避免两处状态源）
export const tagHistory = computed(() => (cfg.value.filterHistory && cfg.value.filterHistory.tag) || [])
export const textHistory = computed(() => (cfg.value.filterHistory && cfg.value.filterHistory.text) || [])

// 状态栏消息：仅承载「进行中 / 瞬时状态」提示（录屏中、连续截图中、抓包已开始等）。
// 所有成功/失败/导出路径等结果性文字一律改走 showResult() -> ResultModal，不再写这里。
export const lastMsg = ref('')

// 程序日志（app.log）运行时开关
export const appLogEnabled = ref(false)

export const toastMsg = ref('')

export const toastShow = ref(false)

export const updateInfo = ref(null)   // 当前应展示的升级信息（null = 不显示状态栏徽标/对话框）

export const maximized = ref(false)

// 窗口置顶开关（默认不置顶；窗口真实状态以主进程为准，启动时查询同步）
export const alwaysOnTop = ref(false)

export const collapsedSidebar = ref(false)

// 快捷按钮区是否展开（默认收起隐藏；状态栏「快捷按钮」开关切换）
export const quickbarVisible = ref(false)
