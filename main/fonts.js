// 枚举系统中已安装的字体族名（零依赖：仅用 Windows 自带的 powershell 读注册表字体键）。
// 渲染进程（浏览器）出于隐私不暴露系统字体，故必须在主进程读取后通过 IPC 下发。
import { spawn } from 'node:child_process'
import { SYSTEM_GET_FONTS } from '../shared/ipc-channels.js'
import { ipcMain } from 'electron'

// 单次 spawn 读取 HKLM / HKLM(32位视图) / HKCU 三个字体键的属性名（即字体族名）。
// PowerShell 经管道重定向给 Node 时默认走系统 OEM 代码页（中文会乱码），故脚本强制 UTF-8 输出，Node 侧用 TextDecoder('utf-8') 解码。
function readAllFontNames() {
  return new Promise((resolve) => {
    // 强制 PowerShell 以 UTF-8 输出（否则重定向给 Node 的管道会用系统 OEM 代码页，中文乱码）
    const ps = "$OutputEncoding=[System.Text.Encoding]::UTF8;[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$keys=@('HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts','HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows NT\\CurrentVersion\\Fonts','HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts');foreach($k in $keys){if(Test-Path $k){$props=(Get-ItemProperty -Path $k).PSObject.Properties;$props|Where-Object{$_.Name-notlike 'PS*'}|ForEach-Object{$_.Name}}}"
    const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true })
    const chunks = []
    p.stdout.on('data', (d) => chunks.push(d))
    p.stderr.on('data', () => {})
    p.on('error', () => resolve([]))
    p.on('close', () => {
      try {
        const text = new TextDecoder('utf-8').decode(Buffer.concat(chunks))
        resolve(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
      } catch {
        resolve([])
      }
    })
  })
}

// 整理：去重、去掉 (TrueType)/(OpenType)/(All Residents) 后缀、按名称排序。
export async function getInstalledFonts() {
  const raw = await readAllFontNames()
  const seen = new Set()
  const out = []
  const suffix = /\s*\((?:TrueType|OpenType|All Residents)\)$/i
  for (const n of raw) {
    if (!n || n === '(Default)' || n === '(default)') continue
    const name = n.replace(suffix, '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

export function registerFontsIpc() {
  ipcMain.handle(SYSTEM_GET_FONTS, async () => getInstalledFonts())
}
