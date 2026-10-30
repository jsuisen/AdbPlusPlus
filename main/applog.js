// 程序自身运行/调试日志落盘：把 console.* 与未捕获异常写入 <落盘目录>/app.log。
// 由「程序日志路径」设置页的开关与目录控制；支持运行时通过 applog:set 即时启停。
import { ipcMain } from 'electron'
import { APPLOG_SET } from '../shared/ipc-channels.js'
import fs from 'node:fs'
import path from 'node:path'
import { defaultOutDir } from './config.js'

let stream = null            // 当前写入流（null = 未开启）
let orig = null              // 原始 console 方法，关闭时还原
let extraHandlersBound = false

function ts() { return new Date().toISOString() }

function toText(a) {
  if (typeof a === 'string') return a
  if (a && a.stack) return a.stack          // Error 对象直接打堆栈
  try { return JSON.stringify(a) } catch { return String(a) }
}

function buildLine(level, args) {
  return `[${ts()}] [${level}] ${args.map(toText).join(' ')}\n`
}

function write(level, args) {
  const line = buildLine(level, args)
  if (stream) { try { stream.write(line) } catch {} }
  if (orig && orig[level]) orig[level](...args)   // 同时保留终端输出，开发期仍可看
}

// 未捕获异常 / 未处理 Promise 拒绝也落盘；handler 始终只注册一次，内部判断 stream 是否存在
function bindExtraHandlers() {
  if (extraHandlersBound) return
  extraHandlersBound = true
  process.on('uncaughtException', (e) => {
    if (stream) stream.write(`[${ts()}] [UNCAUGHT] ${toText(e)}\n`)
  })
  process.on('unhandledRejection', (e) => {
    if (stream) stream.write(`[${ts()}] [UNHANDLED] ${toText(e)}\n`)
  })
}

// 开启程序日志：写入 <dir 或默认 exe 目录>/app.log（追加模式）
export function enableAppLog(dir) {
  if (stream) return
  const target = dir || defaultOutDir()
  try { fs.mkdirSync(target, { recursive: true }) } catch {}
  const file = path.join(target, 'app.log')
  stream = fs.createWriteStream(file, { flags: 'a' })
  orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug }
  console.log = (...a) => write('LOG', a)
  console.info = (...a) => write('INFO', a)
  console.warn = (...a) => write('WARN', a)
  console.error = (...a) => write('ERROR', a)
  console.debug = (...a) => write('DEBUG', a)
  bindExtraHandlers()
  console.log(`[applog] 程序日志已开启，写入 ${file}`)
}

// 关闭程序日志：还原 console 并关闭流
export function disableAppLog() {
  if (orig) { Object.assign(console, orig); orig = null }
  if (stream) { try { stream.end() } catch {} stream = null }
}

// 启动时按配置决定是否落盘（需在窗口创建前尽早调用，多捕获启动期日志）
export function startAppLog(cfg) {
  if (cfg && cfg.appLogEnabled) enableAppLog(cfg.appLogDir || '')
}

// 运行时启停（设置页「程序日志路径」开关 / 改目录后调用）
export function registerAppLogIpc() {
  ipcMain.handle(APPLOG_SET, (_e, { enabled, dir } = {}) => {
    if (enabled) enableAppLog(dir || '')
    else disableAppLog()
    return { ok: true, enabled: !!enabled, dir: dir || '' }
  })
}
