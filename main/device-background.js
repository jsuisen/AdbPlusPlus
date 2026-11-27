// 设备端后台进程公共控制：nohup 脱离 adb 会话 + PID 指针文件 + 精确停止。
// logcat / tcpdump 共用；token / 路径白名单仍由各自 safety 模块负责。
import { run } from './tools.js'

const PID_RE = /^\d+$/

export function safePid(pid) {
  const s = String(pid == null ? '' : pid).trim()
  if (!s) return ''
  if (!PID_RE.test(s) || Number(s) <= 0) throw new Error('PID 非法：' + s)
  return s
}

// 单引号包裹，防路径在设备端 sh 被拆词
export function sq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

// 以 root 运行设备内命令：整条命令串单引号包裹，内部单引号做 '\'' 转义
export function suWrap(cmdStr) {
  return ['su', '-c', "'" + String(cmdStr).replace(/'/g, "'\\''") + "'"]
}

// coreCmd 必须自带输出重定向（断掉与 adb shell 的管道），此处只负责后台化 + 记录 PID。
// 每台设备放一个 current.pid 指针，应用重启后仍能按设备目录找回后台进程。
export function backgroundCmd(coreCmd, pidPath, pointerPath, rootFlagPath, rootFlag) {
  const recordPid = `echo $! > ${sq(pidPath)}; echo $! > ${sq(pointerPath)}`
  // 记录本次是否用 root 启动，供应用重启后精确 kill（root 进程普通 shell 杀不掉）
  const recordRoot = rootFlagPath ? `; echo ${rootFlag === '1' ? '1' : '0'} > ${sq(rootFlagPath)}` : ''
  return `if command -v nohup >/dev/null 2>&1; then nohup ${coreCmd} & else ${coreCmd} & fi; ${recordPid}${recordRoot}`
}

export function shellArgv(serial, cmd, asRoot) {
  return asRoot ? ['-s', serial, 'shell', ...suWrap(cmd)] : ['-s', serial, 'shell', cmd]
}

export async function readPid(serial, pidPath, asRoot) {
  const argv = asRoot ? ['-s', serial, 'shell', ...suWrap('cat ' + sq(pidPath))] : ['-s', serial, 'shell', 'cat', pidPath]
  const r = await run('adb.exe', argv)
  if (r.code !== 0) return ''
  try { return safePid((r.out || '').trim().split(/\s+/)[0] || '') } catch { return '' }
}

// 进程是否还活着：kill -0 不发信号，只做权限/存在性探测
export async function alive(serial, pid, asRoot) {
  if (!pid) return false
  const r = await run('adb.exe', shellArgv(serial, `kill -0 ${pid}`, asRoot)).catch(() => ({ code: -1 }))
  return r.code === 0
}

// 读 PID（优先专属 .pid，缺失时读 current.pid），精确 kill -INT 刷盘；
// 两者都读不到才走 fallbackCmd（如 pkill），并标记 fallback 供 UI 提示。
export async function stopByPid(serial, { pidPath, pointerPath, asRoot, fallbackCmd }) {
  let pid = await readPid(serial, pidPath, asRoot)
  if (!pid && pointerPath && pointerPath !== pidPath) pid = await readPid(serial, pointerPath, asRoot)
  let fallback = false
  if (pid) {
    const r = await run('adb.exe', shellArgv(serial, `kill -INT ${pid}; rm -f ${sq(pidPath)} ${sq(pointerPath)}`, asRoot))
    if (r.code !== 0) throw new Error('停止失败：' + (r.err || r.code))
  } else if (fallbackCmd) {
    fallback = true
    await run('adb.exe', shellArgv(serial, fallbackCmd, asRoot)).catch(() => {})
  }
  return { pid, fallback }
}
