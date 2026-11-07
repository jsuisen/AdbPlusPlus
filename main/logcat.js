// Logcat 多设备并行采集：每个设备独立维护一个 spawn 会话（child + 行读取器 + 环缓冲 + 批量推送）。
// 通过 serial 区分设备，前端可同时采集多台设备、各自独立开始/停止/查看。
// 单条日志格式 threadtime：MM-DD HH:MM:SS.mmm  PID  TID  LEVEL  TAG: msg
// 行解析 / 编码边界 / 折行归并统一交给 ./logcat-ingest.js（纯函数，可单测），本文件只管进程与 IPC。
import { ipcMain } from 'electron'
import { LOGCAT_DATA, PROC_CHANGED, LOGCAT_CLOSED, LOGCAT_START, LOGCAT_STDERR, LOGCAT_ERROR, LOGCAT_STARTED, LOGCAT_STOP } from '../shared/ipc-channels.js'
import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { resolveTool } from './tools.js'
import { createLineReader, createIngestState, ingestLines } from './logcat-ingest.js'

const MAX_BUFFER = 200000          // 单设备主进程内存环缓冲上限（行）
const FLUSH_INTERVAL = 200         // 批量推送间隔（ms）

// serial -> { serial, child, reader, errDecoder, state, batchTimer, procChangeTimer }
const sessions = new Map()
let winRef = null

function flush(session) {
  session.batchTimer = null
  const batch = session.state.pending
  session.state.pending = []   // 无条件清空：窗口销毁后 pending 也不再无界增长
  if (batch.length && winRef && !winRef.isDestroyed()) {
    winRef.webContents.send(LOGCAT_DATA, { serial: session.serial, batch })
  }
}

function ingest(session, chunk) {
  const lines = session.reader.feed(chunk)
  ingestLines(session.state, lines, () => emitProcChanged(session.serial))
  if (session.state.pending.length && !session.batchTimer) {
    session.batchTimer = setTimeout(() => flush(session), FLUSH_INTERVAL)
  }
}

// 进程启停事件：从日志流识别 ActivityManager 的 Start proc / 进程退出，去抖后通知渲染进程刷新该设备进程下拉。
function emitProcChanged(serial) {
  const session = sessions.get(serial)
  if (!session) return
  if (session.procChangeTimer) return
  session.procChangeTimer = setTimeout(() => {
    session.procChangeTimer = null
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(PROC_CHANGED, serial)
  }, 500)
}

// 停止某设备的 logcat 会话。silent=true 时为同设备重开前的内部调用，不再向渲染进程发 closed，
// 避免 closed 事件把前端 runningMap 误翻成 false（重开后前端会立即置 true）。
function stopSession(serial, silent) {
  const session = sessions.get(serial)
  if (!session) return
  // 会话结束前交出「尚未以换行结尾」的最后一行，避免丢尾行
  const tailLines = session.reader.end()
  if (tailLines.length) {
    ingestLines(session.state, tailLines)   // 停止时不再触发进程刷新事件
    flush(session)
  }
  if (session.batchTimer) { clearTimeout(session.batchTimer); session.batchTimer = null }
  if (session.procChangeTimer) { clearTimeout(session.procChangeTimer); session.procChangeTimer = null }
  if (session.child) { try { session.child.kill('SIGINT') } catch {} session.child = null }
  sessions.delete(serial)
  if (!silent && winRef && !winRef.isDestroyed()) winRef.webContents.send(LOGCAT_CLOSED, serial)
}

export function registerLogcatIpc(win) {
  winRef = win

  ipcMain.on(LOGCAT_START, (_e, opts = {}) => {
    const serial = opts && opts.serial
    if (!serial) return   // serial 必填，多设备并行靠它区分
    stopSession(serial, true)   // 同设备重开：先静默停旧会话
    const serialArgs = ['-s', serial]
    const buffers = (opts.buffers && opts.buffers.length)
      ? opts.buffers.flatMap((b) => ['-b', b])
      : ['-b', 'main', '-b', 'system', '-b', 'crash']
    const args = [...serialArgs, 'logcat', '-v', 'threadtime', ...buffers]
    const session = {
      serial, child: null,
      reader: createLineReader(),
      errDecoder: new StringDecoder('utf8'),
      state: createIngestState(MAX_BUFFER),
      batchTimer: null, procChangeTimer: null
    }
    sessions.set(serial, session)
    session.child = spawn(resolveTool('adb.exe'), args, { windowsHide: true })
    session.child.stdout.on('data', (chunk) => ingest(session, chunk))
    session.child.stderr.on('data', (d) => {
      const text = session.errDecoder.write(d)
      if (text && winRef && !winRef.isDestroyed()) winRef.webContents.send(LOGCAT_STDERR, { serial, text })
    })
    session.child.on('error', (e) => {
      if (winRef && !winRef.isDestroyed()) winRef.webContents.send(LOGCAT_ERROR, { serial, text: String(e) })
    })
    session.child.on('close', () => {
      if (winRef && !winRef.isDestroyed()) winRef.webContents.send(LOGCAT_CLOSED, serial)
    })
    if (winRef && !winRef.isDestroyed()) winRef.webContents.send(LOGCAT_STARTED, serial)
  })

  // logcat:stop 带 serial 停指定设备；不带则停全部（窗口关闭等场景）
  ipcMain.on(LOGCAT_STOP, (_e, serial) => {
    if (serial) stopSession(serial)
    else for (const s of [...sessions.keys()]) stopSession(s)
  })
}
