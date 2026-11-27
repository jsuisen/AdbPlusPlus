// 文件对话框 / 落地 IPC：导出日志、选截图/录屏保存路径、选本地 APK。
// 渲染进程无 nodeIntegration，所有文件写盘都在主进程完成。
import { ipcMain, dialog, clipboard, shell, nativeImage } from 'electron'
import { FILE_PICK_SAVE, FILE_OPEN_FILE, FILE_PICK_DIR, FILE_SAVE_TEXT, FILE_READ_TEXT, FILE_READ_IMAGE, FILE_OPEN_DIR, LOG_APPEND, CLIPBOARD_WRITE } from '../shared/ipc-channels.js'
import fs from 'node:fs'
import path from 'node:path'

export function registerFileIpc() {
  // 仅弹保存对话框，返回路径（不写内容），供主进程二进制写盘（截图/录屏）复用
  ipcMain.handle(FILE_PICK_SAVE, async (_e, { defaultPath, filters }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath, filters })
    if (canceled || !filePath) return null
    return filePath
  })

  // 弹打开对话框，返回选中文件路径
  ipcMain.handle(FILE_OPEN_FILE, async (_e, { filters }) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters })
    if (canceled || !filePaths.length) return null
    return filePaths[0]
  })

  // 背景图读取：受控读取图片 -> 等比缩放 -> data URL。只服务设置面板，不做跨请求缓存。
  ipcMain.handle(FILE_READ_IMAGE, async (_e, { path: p } = {}) => {
    if (typeof p !== 'string' || !p.trim()) return null
    const ext = path.extname(p).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return null
    try {
      const st = await fs.promises.stat(p)
      if (!st.isFile() || st.size > 10 * 1024 * 1024) return null
      const img = nativeImage.createFromPath(p)
      if (img.isEmpty()) return null
      const { width, height } = img.getSize()
      const scale = Math.min(1, 1920 / Math.max(width, height))
      const out = scale < 1
        ? img.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'good' })
        : img
      return out.toDataURL()
    } catch {
      return null
    }
  })

  // 弹目录选择对话框，返回选中的目录路径（日志自动保存路径用）；取消返回 null
  ipcMain.handle(FILE_PICK_DIR, async (_e, { defaultPath } = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], defaultPath })
    if (canceled || !filePaths.length) return null
    return filePaths[0]
  })

  // 写文本（日志导出）
  ipcMain.handle(FILE_SAVE_TEXT, async (_e, { content, defaultPath, filters }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath, filters })
    if (canceled || !filePath) return null
    await fs.promises.writeFile(filePath, content, 'utf8')
    return filePath
  })

  // 读取文本文件内容（加载配置用）；渲染进程无 node，走主进程读盘
  ipcMain.handle(FILE_READ_TEXT, async (_e, { path: p }) => {
    if (!p) throw new Error('path 必填')
    return fs.readFileSync(p, 'utf8')
  })

  // 追加写入日志（日志自动保存用）：异步落盘、不阻塞渲染；父目录不存在则创建。写入失败静默忽略。
  ipcMain.handle(LOG_APPEND, async (_e, { path: p, text }) => {
    try {
      await fs.promises.mkdir(path.dirname(p), { recursive: true })
      await fs.promises.appendFile(p, text, 'utf8')
    } catch (e) { console.error('[log:append] 日志自动保存写入失败:', p, e) }
  })

  // 写入系统剪贴板（日志窗口右键"复制"用）。渲染进程无 nodeIntegration，走主进程。
  ipcMain.handle(CLIPBOARD_WRITE, async (_e, { text }) => {
    try { clipboard.writeText(text || '') } catch (e) { console.error('[clipboard:write] 写入剪贴板失败:', e) }
  })

  // 用系统文件管理器打开指定目录（日志「浏览」按钮打开自动保存目录）；路径为空或不存在时忽略
  ipcMain.handle(FILE_OPEN_DIR, async (_e, { path: p } = {}) => {
    if (!p) return
    try { await shell.openPath(p) } catch (e) { console.error('[file:openDir] 打开目录失败:', p, e) }
  })
}
