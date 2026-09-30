// 安全桥：渲染进程只能通过本文件暴露的 window.api 与主进程通信。
// contextIsolation 开启、nodeIntegration 关闭，杜绝渲染进程直接碰 Node。
// 通道白名单：invoke/send/on 分别只放行 shared/ipc-channels.js 中登记的通道，
// 未登记的通道直接拒绝（防渲染进程被注入后探测/调用任意主进程能力）。
import { contextBridge, ipcRenderer } from 'electron'
import { INVOKE_CHANNELS, SEND_CHANNELS, ON_CHANNELS } from '../shared/ipc-channels.js'

contextBridge.exposeInMainWorld('api', {
  // 请求/响应型（Promise，如查询设备列表、执行 adb 命令）
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error('未授权的 IPC 通道: ' + channel))
    return ipcRenderer.invoke(channel, ...args)
  },
  // 一问一答之外的单向触发（如启动 logcat）
  send: (channel, ...args) => {
    if (!SEND_CHANNELS.has(channel)) { console.warn('[preload] 拒绝 send 未登记通道:', channel); return }
    ipcRenderer.send(channel, ...args)
  },
  // 订阅主进程主动推送（如 logcat 实时行），返回取消订阅函数
  on: (channel, cb) => {
    if (!ON_CHANNELS.has(channel)) { console.warn('[preload] 拒绝 on 未登记通道:', channel); return () => {} }
    const listener = (_e, ...args) => cb(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
})
