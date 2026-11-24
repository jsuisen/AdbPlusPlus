// 共享工具：解析 adb/aapt 二进制路径 + 安全 spawn 封装。
// 统一用参数数组调用 spawn，不拼 shell 字符串，防命令注入。
import { app } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { mt } from './i18n.js'

export function getResourcesDir() {
  // 打包后：process.resourcesPath/resources
  // 开发期：项目根/resources（isPackaged 为 false，避免误用 Electron 安装目录的 resources 导致 aapt 等找不到）
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources')
  }
  return path.join(app.getAppPath(), 'resources')
}

// 优先用打包进 resources 的二进制，找不到再回退 PATH（开发机已配环境变量的场景）
export function resolveTool(name) {
  const bundled = path.join(getResourcesDir(), name)
  if (fs.existsSync(bundled)) return bundled
  return name
}

// 通用运行：返回 { code, out, err }
// opts.timeoutMs > 0 时给子进程加看门狗：超时杀掉本条 adb CLI 并返回带标记的部分输出，
// 绝不把「设备/adb server 无响应」变成永不 settle 的 Promise（启动期 refreshDevices 会因此卡在 refreshing=true）。
// 不给 timeoutMs 的调用（bugreport/pull/install 等长命令）行为完全不变。
export function run(tool, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const exe = resolveTool(tool)
    const { timeoutMs, ...spawnOpts } = opts
    const p = spawn(exe, args, { windowsHide: true, ...spawnOpts })
    let out = ''
    let err = ''
    let timer = null
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      fn(value)
    }
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        err += mt('err.toolTimeout', { ms: timeoutMs, tool })
        try { p.kill() } catch {}
      }, timeoutMs)
    }
    if (p.stdout) p.stdout.on('data', (d) => { out += d.toString() })
    if (p.stderr) p.stderr.on('data', (d) => { err += d.toString() })
    p.on('error', (e) => finish(reject, e))
    p.on('close', (code) => finish(resolve, { code, out, err }))
  })
}
