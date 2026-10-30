// APK 能力：列设备已装包 / 拉取 APK 到本机 / 用 aapt 解析包信息。
// 连机已装应用用 pm list packages -f；离线或已拉取的本地 APK 用 aapt dump badging。
import { ipcMain } from 'electron'
import { APK_LIST, APK_PULL, APK_PARSE } from '../shared/ipc-channels.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { run, resolveTool } from './tools.js'

// 计算文件 MD5（流式，避免大 APK 一次性读入内存）
function md5File(p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('md5')
    const s = fs.createReadStream(p)
    s.on('data', (d) => h.update(d))
    s.on('end', () => resolve(h.digest('hex')))
    s.on('error', reject)
  })
}

function parseAapt(out) {
  const r = { package: '', versionCode: '', versionName: '', label: '', launchable: '', permissions: [] }
  for (const ln of out.split(/\r?\n/)) {
    let m
    if ((m = ln.match(/^package:.*?name='([^']+)'.*?versionCode='([^']+)'.*?versionName='([^']+)'/))) {
      r.package = m[1]; r.versionCode = m[2]; r.versionName = m[3]
    } else if ((m = ln.match(/^launchable-activity:.*?name='([^']+)'/))) {
      r.launchable = m[1]
    } else if ((m = ln.match(/^application:.*?label='([^']+)'/))) {
      r.label = m[1]
    } else if ((m = ln.match(/^uses-permission:.*?name='([^']+)'/))) {
      r.permissions.push(m[1])
    }
  }
  return r
}

export function registerApkIpc() {
  // 列设备已装包：package:/path/to/apk=com.pkg
  ipcMain.handle(APK_LIST, async (_e, { serial }) => {
    if (!serial) throw new Error('serial 必填')
    const { out } = await run('adb.exe', ['-s', serial, 'shell', 'pm', 'list', 'packages', '-f'])
    const pkgs = []
    for (const ln of out.split(/\r?\n/)) {
      const m = ln.match(/^package:(\S+)=(\S+)$/)
      if (m) pkgs.push({ path: m[1], pkg: m[2] })
    }
    return pkgs
  })

  // 拉取设备上的 APK 到本机
  ipcMain.handle(APK_PULL, async (_e, { serial, pkgPath, outPath }) => {
    if (!serial || !pkgPath || !outPath) throw new Error('serial / pkgPath / outPath 必填')
    const r = await run('adb.exe', ['-s', serial, 'pull', pkgPath, outPath])
    if (r.code !== 0) throw new Error(r.err || 'pull 失败')
    return outPath
  })

  // 解析本地 APK（支持已拉取的设备包或用户自选文件）
  ipcMain.handle(APK_PARSE, async (_e, { apkPath }) => {
    if (!apkPath || !fs.existsSync(apkPath)) throw new Error('apkPath 不存在')
    // aapt 是原生程序，按系统 ANSI 代码页解析命令行参数，遇到中文等非 ASCII 路径会报
    // “Illegal byte sequence / no AndroidManifest.xml found”。先复制到临时目录用 ASCII 文件名解析，结束即删。
    let target = apkPath
    let tmp = null
    if (/[^\x00-\x7F]/.test(apkPath)) {
      tmp = path.join(os.tmpdir(), `adbpp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.apk`)
      fs.copyFileSync(apkPath, tmp)
      target = tmp
    }
    try {
      const r = await run('aapt.exe', ['dump', 'badging', target])
      if (r.code !== 0) throw new Error(r.err || 'aapt 解析失败')
      const info = parseAapt(r.out)
      // 附带文件名与 MD5，便于核对 APK 身份
      info.fileName = path.basename(apkPath)
      info.md5 = await md5File(apkPath)
      return info
    } finally {
      if (tmp) { try { fs.unlinkSync(tmp) } catch {} }
    }
  })
}
