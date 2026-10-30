// 共享工具：解析 adb/aapt 二进制路径 + 安全 spawn 封装。
// 统一用参数数组调用 spawn，不拼 shell 字符串，防命令注入。
import { app } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

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
export function run(tool, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const exe = resolveTool(tool)
    const p = spawn(exe, args, { windowsHide: true, ...opts })
    let out = ''
    let err = ''
    if (p.stdout) p.stdout.on('data', (d) => { out += d.toString() })
    if (p.stderr) p.stderr.on('data', (d) => { err += d.toString() })
    p.on('error', reject)
    p.on('close', (code) => resolve({ code, out, err }))
  })
}
