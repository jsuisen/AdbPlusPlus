// Bootstrap：创建窗口、注册各模块 IPC。所有子进程调用收口在主进程。
import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { WINDOW_MINIMIZE, WINDOW_TOGGLE_MAX, WINDOW_CLOSE, WINDOW_IS_MAXIMIZED, WINDOW_ZOOM_IN, WINDOW_ZOOM_OUT, WINDOW_MAXIMIZE_STATE, APP_META, APP_CHECK_UPDATE, APP_UPDATE_AVAILABLE } from '../shared/ipc-channels.js'
import { checkForUpdates } from './versioncheck.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerAdbIpc } from './adb.js'
import { registerLogcatIpc } from './logcat.js'
import { registerMediaIpc } from './media.js'
import { registerNetcapIpc } from './netcap.js'
import { registerApkIpc } from './apk.js'
import { registerConfigIpc, loadConfig } from './config.js'
import { registerFileIpc } from './file.js'
import { registerAppLogIpc, startAppLog } from './applog.js'
import { registerFontsIpc } from './fonts.js'
import { registerDeviceTrackerIpc } from './devices.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let win = null

// 自定义工具：隐藏默认应用菜单（否则会自带 View 缩放等加速器，与下方自定义缩放冲突/重复触发）
Menu.setApplicationMenu(null)

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    frame: false,        // 去掉原生标题栏，改用菜单栏内自定义窗口控制
    thickFrame: true,     // Windows：保留可拖拽改变窗口大小的边框
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_DEV) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  registerLogcatIpc(win)   // 需要 win 引用推送实时行
  registerDeviceTrackerIpc(win)   // 长驻跟踪设备连接事件，变化时推送渲染进程刷新
  registerAdbIpc()
  registerMediaIpc()
  registerNetcapIpc(win)   // 网络抓包：设备端 tcpdump 常驻 + 停止刷盘 + 按需 pull（需 win 推送事件）
  registerApkIpc()
  registerConfigIpc()
  registerFileIpc()
  registerFontsIpc()   // 系统已安装字体列表（设置面板「日志字体」下拉用，零依赖读注册表）
  registerAppLogIpc()   // 程序日志运行时启停（设置页「程序日志路径」开关 / 目录）

  // 自定义标题栏：窗口控制（最小化 / 最大化切换 / 关闭）
  ipcMain.on(WINDOW_MINIMIZE, () => win.minimize())
  ipcMain.on(WINDOW_TOGGLE_MAX, () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(WINDOW_CLOSE, () => win.close())
  ipcMain.handle(WINDOW_IS_MAXIMIZED, () => win.isMaximized())
  win.on('maximize', () => win.webContents.send(WINDOW_MAXIMIZE_STATE, true))
  win.on('unmaximize', () => win.webContents.send(WINDOW_MAXIMIZE_STATE, false))

  // 运行环境元信息（关于弹窗展示）：版本号以 package.json semver 为单一事实来源
  ipcMain.handle(APP_META, () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node }))

  // 手动「版本检测」：渲染进程（关于弹窗按钮 / 升级对话框）主动调用，返回检测结果（或错误）
  ipcMain.handle(APP_CHECK_UPDATE, async () => { try { return await checkForUpdates() } catch (e) { return { error: e.message } } })

  // 缩放（供渲染进程 ctrl+滚轮 调用）：步进 0.1、范围 0.3~3
  ipcMain.on(WINDOW_ZOOM_IN, () => {
    const f = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(Math.min(f + 0.1, 3))
  })
  ipcMain.on(WINDOW_ZOOM_OUT, () => {
    const f = win.webContents.getZoomFactor()
    win.webContents.setZoomFactor(Math.max(f - 0.1, 0.3))
  })

  // 缩放（键盘）：Ctrl/Cmd + +/-/0。在主进程用 before-input-event 拦截，按物理键 code 匹配，布局无关最稳。
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!input.control && !input.meta) return
    const code = input.code
    const key = input.key
    const isIn = code === 'Equal' || code === 'NumpadAdd' || key === '+' || key === '='
    const isOut = code === 'Minus' || code === 'NumpadSubtract' || key === '-'
    const isReset = code === 'Digit0' || code === 'Numpad0' || key === '0'
    if (!isIn && !isOut && !isReset) return
    event.preventDefault()
    const f = win.webContents.getZoomFactor()
    if (isReset) win.webContents.setZoomFactor(1)
    else if (isIn) win.webContents.setZoomFactor(Math.min(f + 0.1, 3))
    else win.webContents.setZoomFactor(Math.max(f - 0.1, 0.3))
  })
}

app.whenReady().then(() => {
  startAppLog(loadConfig())   // 按配置决定是否把程序运行/调试日志落盘（窗口创建前尽早开启，多捕获启动期日志）
  createWindow()
  // 启动后 30 秒异步检测一次版本升级（受「启动时检测版本升级」配置开关控制）；有更新才推送渲染进程
  if (loadConfig().checkUpdateOnStartup) {
    setTimeout(() => {
      checkForUpdates()
        .then(r => { if (r && r.hasUpdate) win.webContents.send(APP_UPDATE_AVAILABLE, r) })
        .catch(() => {})
    }, 30000)
  }
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
