// 媒体能力：截图（screencap）、录屏（screenrecord）。
// 录屏走「设备落盘 -> 停止 -> pull 到本机」流程，规避流式 h264 需要 ffmpeg 的复杂度。
import { ipcMain } from 'electron'
import { MEDIA_SCREENSHOT, MEDIA_SCREENSHOT_TO_DIR, MEDIA_RECORD_START, MEDIA_RECORD_STOP } from '../shared/ipc-channels.js'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { run, resolveTool } from './tools.js'

let recChild = null
let recDevicePath = null
let recSerial = null

export function registerMediaIpc() {
  // 截图：adb exec-out screencap -p -> 二进制直写文件
  ipcMain.handle(MEDIA_SCREENSHOT, async (_e, { serial, outPath }) => {
    if (!serial || !outPath) throw new Error('serial 与 outPath 必填')
    const p = spawn(resolveTool('adb.exe'), ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true })
    const chunks = []
    p.stdout.on('data', (d) => chunks.push(d))
    const code = await new Promise((r) => p.on('close', r))
    if (code !== 0) throw new Error('screencap 失败，exit=' + code)
    fs.writeFileSync(outPath, Buffer.concat(chunks))
    return outPath
  })

  // 截图到指定目录（按文件名落盘，连续截图用）：主进程建目录、拼完整路径、screencap 直写文件
  ipcMain.handle(MEDIA_SCREENSHOT_TO_DIR, async (_e, { serial, dir, name }) => {
    if (!serial || !dir || !name) throw new Error('serial / dir / name 必填')
    fs.mkdirSync(dir, { recursive: true })
    const outPath = path.join(dir, name)
    const p = spawn(resolveTool('adb.exe'), ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true })
    const chunks = []
    p.stdout.on('data', (d) => chunks.push(d))
    const code = await new Promise((r) => p.on('close', r))
    if (code !== 0) throw new Error('screencap 失败，exit=' + code)
    fs.writeFileSync(outPath, Buffer.concat(chunks))
    return outPath
  })

  // 录屏开始：在设备端 screenrecord 到固定路径（单段 ≤3 分钟）
  ipcMain.handle(MEDIA_RECORD_START, async (_e, { serial, devicePath }) => {
    if (!serial) throw new Error('serial 必填')
    const dev = devicePath || '/sdcard/adbtool_rec.mp4'
    recSerial = serial
    recDevicePath = dev
    recChild = spawn(resolveTool('adb.exe'), ['-s', serial, 'shell', 'screenrecord', dev], { windowsHide: true })
    return dev
  })

  // 录屏停止：关键是用设备端 SIGINT 让 screenrecord 自己写 moov 尾部，严禁先杀本地 adb（会瞬间杀掉设备进程、丢失 MP4 尾部导致无法播放）
  ipcMain.handle(MEDIA_RECORD_STOP, async (_e, { outPath }) => {
    if (!outPath) throw new Error('outPath 必填')
    if (!recSerial || !recDevicePath) throw new Error('没有进行中的录屏')
    // 1) 只给设备端 screenrecord 发 SIGINT，它捕获后会自行写 moov 元数据并退出（不碰本地 adb 子进程，避免会话断开强杀设备进程）
    await run('adb.exe', ['-s', recSerial, 'shell', 'pkill', '-INT', 'screenrecord']).catch(() => {})
    await run('adb.exe', ['-s', recSerial, 'shell', 'kill', '-2', '$(pidof screenrecord)']).catch(() => {})
    // 2) 等待设备完成 moov 写入（大文件适当放宽，宁可多等也别 pull 半截文件）
    await new Promise((r) => setTimeout(r, 1500))
    // 3) 远端退出后本地 adb shell 会自动返回；兜底清掉残留子进程（此时文件已 pull 完成，杀本地不影响产物）
    if (recChild) { try { recChild.kill() } catch {} recChild = null }
    // 4) 拉取到本机
    const pull = await run('adb.exe', ['-s', recSerial, 'pull', recDevicePath, outPath])
    if (pull.code !== 0) throw new Error('pull 失败：' + pull.err)
    await run('adb.exe', ['-s', recSerial, 'shell', 'rm', '-f', recDevicePath]).catch(() => {})
    recSerial = null
    recDevicePath = null
    return outPath
  })
}
