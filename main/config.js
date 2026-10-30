// 配置持久化：快捷命令、过滤条件、上次序列号、导出目录等存到 exe/工程根同级的 JSON。
import { ipcMain, app } from 'electron'
import { CONFIG_GET, CONFIG_SAVE } from '../shared/ipc-channels.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 配置文件存放目录：与 exe（打包态）或工程根（开发态，含 logs 目录）同级，方便整体拷贝/便携。
// 风险：若安装到受控目录（如 C:\Program Files），普通权限无法写入，需以管理员运行或选择可写目录安装。
function configDir() {
  if (app.isPackaged) return path.dirname(app.getPath('exe'))
  return path.resolve(__dirname, '..')
}

// 配置文件默认位置（与 exe/工程根同级）
function defaultCfgPath() {
  return path.join(configDir(), 'adbtool-config.json')
}

// 指针文件：固定在 userData，记录用户自定义的配置文件路径。
// “配置文件路径”本身也要被记住，程序重启后得有个永远可写的地方找回它；userData 不受 Program Files 权限限制。
const pointerPath = path.join(app.getPath('userData'), 'adbtool-path.json')

// 解析真实配置文件路径：指针里有自定义路径就用它，否则用默认位置
function resolveCfgPath() {
  try {
    const p = JSON.parse(fs.readFileSync(pointerPath, 'utf8')).configPath
    if (typeof p === 'string' && p.trim()) return p.trim()
  } catch {}
  return defaultCfgPath()
}

// 当前生效的配置文件路径（load 时确定，save 时更新）
let activeCfgPath = defaultCfgPath()

// 自动保存日志的默认落盘目录：打包后取 exe 所在目录；开发态取工程根（main 的上一级）。
export function defaultOutDir() {
  if (app.isPackaged) return path.dirname(app.getPath('exe'))
  return path.resolve(__dirname, '..')
}

const DEFAULT = {
  quickCommands: [],   // [{ name, args: string[] }]
  levelFilter: '',     // V/D/I/W/E/F 或空
  tagFilter: '',
  textFilter: '',
  lastSerial: '',
  outDir: '',          // 空 → 落到 exe 所在目录
  targetPkg: '',
  configPath: '',      // 自定义 adbtool-config.json 路径（完整文件路径，含文件名）；空 → 用默认位置（exe/工程根同级）
  autoLog: false,      // 是否自动写日志到磁盘
  appLogEnabled: false, // 是否把程序自身运行/调试日志（console.*）落盘到 app.log
  appLogDir: '',       // 程序日志落盘目录：空 → 落到 exe 所在目录
  logColors: {},
  logFont: { size: 12, family: '"Cascadia Code", Consolas, monospace', bold: false }, // 日志窗口字体：大小(px)/类型/是否加粗
  keyButtons: [],       // 用户新增的模拟按键（预设键不存盘）
  textButtons: [],      // 用户新增的输入文本动作（名称 + 文本值）
  tapButtons: [],       // 用户新增的模拟点击动作（名称 + x/y）
  swipeButtons: [],      // 用户新增的模拟滑动动作（名称 + x1/y1/x2/y2/duration）
  captureArgs: '-p -vv -s 0 -w',        // tcpdump 参数（设置 tab 文本框，默认即用户给的命令参数）
  captureDeviceDir: '/sdcard/adbpp_captures/', // 设备端抓包落盘目录（设置 tab「生成包文件路径」，可改）
  captureLocalDir: '',  // 本机保存目录：空 → cfg.outDir + '/captures'
  captureAsRoot: false, // 是否以 root 运行 tcpdump（su -c 仅给 tcpdump 提权，默认关，延续「默认 shell」决定）
  screenshotDir: '',    // 截图保存目录：空 → 落到 exe 所在目录
  screenshotInterval: 1000, // “开始截图”连续截图间隔（毫秒），默认 1000（每秒 1 张）
  maxRender: 20000,        // 日志窗口渲染上限（过滤后截取尾部行数）；日志刷得快的设大些可看更久历史
  checkUpdateOnStartup: true, // 启动后是否异步检测一次版本升级（默认开启）
  updateDismissedDate: ''     // 本日已「取消提醒」的日期（YYYY-MM-DD），当天不再弹升级对话框
}

export function loadConfig() {
  activeCfgPath = resolveCfgPath()
  let raw = {}
  try {
    raw = JSON.parse(fs.readFileSync(activeCfgPath, 'utf8'))
  } catch { raw = {} }
  const merged = { ...DEFAULT, ...raw }
  // outDir 为空时落到 exe 所在目录，保证自动日志/导出有可写落点
  if (!merged.outDir) merged.outDir = defaultOutDir()
  // appLogDir 为空时同样落到 exe 所在目录
  if (!merged.appLogDir) merged.appLogDir = defaultOutDir()
  // screenshotDir 为空时落到 exe 所在目录（截图到路径 / 连续截图的默认落点）
  if (!merged.screenshotDir) merged.screenshotDir = defaultOutDir()
  return merged
}

export function saveConfig(cfg) {
  // 本次落盘路径：配置里带了自定义 configPath 就用它，否则用默认位置
  const target = (typeof cfg.configPath === 'string' && cfg.configPath.trim())
    ? cfg.configPath.trim()
    : defaultCfgPath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(cfg, null, 2))
  // 指针文件同步：自定义路径则记录，否则删除指针（走默认位置）
  if (target === defaultCfgPath()) {
    try { fs.rmSync(pointerPath, { force: true }) } catch {}
  } else {
    fs.mkdirSync(path.dirname(pointerPath), { recursive: true })
    fs.writeFileSync(pointerPath, JSON.stringify({ configPath: target }, null, 2))
  }
  activeCfgPath = target
  return cfg
}

export function registerConfigIpc() {
  ipcMain.handle(CONFIG_GET, () => loadConfig())
  ipcMain.handle(CONFIG_SAVE, (_e, cfg) => saveConfig(cfg))
}
