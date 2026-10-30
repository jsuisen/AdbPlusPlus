// 设备连接事件监听：长驻 spawn `adb track-devices`，设备集合（插拔 / adb connect / 状态变更）变化时
// 通知渲染进程重新拉取权威设备列表。采用事件驱动而非轮询，设备变动即时刷新，行为对齐 Android Studio。
// 注意：track-devices 只负责“唤醒”，具体列表由渲染进程调 `adb:devices` 重查，避免直接解析 tracker 文本带来的分片/格式歧义。
import { spawn } from 'node:child_process'
import { ADB_DEVICES_CHANGED } from '../shared/ipc-channels.js'
import { resolveTool } from './tools.js'

let child = null
let winRef = null
let sendTimer = null
let restartTimer = null

// 单次变动可能伴随多行输出，250ms 内合并为一次通知，避免渲染进程短时间内反复刷新
function notify() {
  if (sendTimer) return
  sendTimer = setTimeout(() => {
    sendTimer = null
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(ADB_DEVICES_CHANGED)
  }, 250)
}

function start() {
  if (child) return
  child = spawn(resolveTool('adb.exe'), ['track-devices'], { windowsHide: true })
  child.stdout.on('data', notify)
  child.stderr.on('data', () => {})
  child.on('error', scheduleRestart)
  child.on('close', () => { child = null; scheduleRestart() })
}

// 进程异常退出（如 adb server 未起）后延时重启，adb server 恢复即重新跟踪
function scheduleRestart() {
  if (restartTimer) return
  restartTimer = setTimeout(() => { restartTimer = null; start() }, 3000)
}

export function registerDeviceTrackerIpc(win) {
  winRef = win
  start()
}
