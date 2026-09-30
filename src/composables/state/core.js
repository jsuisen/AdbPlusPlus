// 共享状态：跨域基础（api 桥 / 配置 / 全局消息 / 窗口状态）+ 日志默认配色/字体常量
import { ref } from 'vue'

export const api = window.api

export const DEFAULT_LOG_COLORS = { V: '#CFC4C6', D: '#CFC4C6', I: '#000000', W: '#FFC0C0', E: '#FF0000', F: '#FF0000' }

export const DEFAULT_LOG_COLOR_BOLD = { V: false, D: false, I: false, W: false, E: false, F: false }

export const DEFAULT_LOG_BG_COLORS = { V: '#FFFFFF', D: '#FFFFFF', I: '#FFFFFF', W: '#FFFFFF', E: '#FFFFFF', F: '#FFFFFF' }

export const DEFAULT_LOG_BG_ON = { V: false, D: false, I: false, W: false, E: false, F: false }

export const DEFAULT_LOG_FONT = { size: 12, family: '"Cascadia Code", Consolas, monospace', bold: false, lineHeight: 1.4 }

export const cfg = ref({ quickCommands: [], lastSerial: '', outDir: '', targetPkg: '', configPath: '', autoLog: false, appLogEnabled: false, appLogDir: '', closeOnOuterClick: false, checkUpdateOnStartup: true, updateDismissedDate: '', cursorMoveNoScroll: true, logColors: { ...DEFAULT_LOG_COLORS }, logBgColors: { ...DEFAULT_LOG_BG_COLORS }, logBgOn: { ...DEFAULT_LOG_BG_ON }, logFont: { ...DEFAULT_LOG_FONT }, captureArgs: '-p -vv -s 0 -w', captureDeviceDir: '/sdcard/adbpp_captures/', captureLocalDir: '', captureAsRoot: false, screenshotDir: '', maxRender: 20000, screenshotInterval: 1000 })

// 状态栏消息（各操作的即时反馈）
export const lastMsg = ref('')

// 程序日志（app.log）运行时开关
export const appLogEnabled = ref(false)

export const toastMsg = ref('')

export const toastShow = ref(false)

export const updateInfo = ref(null)   // 当前应展示的升级信息（null = 不显示状态栏徽标/对话框）

export const maximized = ref(false)

export const collapsedSidebar = ref(false)
