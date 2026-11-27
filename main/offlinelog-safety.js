// 设备端 logcat 命令安全边界（与 netcap-safety.js 同思路，但 logcat 过滤表达式含 '*'）。
// adbd 会把 adb shell 的参数拼成字符串交给 /system/bin/sh -c，
// 故所有用户可控 token 必须先过白名单；拒绝 shell 元字符，不做字符黑名单猜测。

// 选项：-v / -s / -b / -t 100 / --pid=123；过滤表达式：*:V / Tag:D / MyTag:V
const SAFE_TOKEN_RE = /^(?:--?[A-Za-z0-9][A-Za-z0-9-]*(?:=\d+)?|[A-Za-z0-9*][A-Za-z0-9._:/,=*+-]*)$/
const SAFE_DEVICE_PATH_RE = /^\/[A-Za-z0-9._/-]*$/
const PID_RE = /^\d+$/

export function safeLogcatTokens(args) {
  const raw = args == null ? '' : String(args).trim()
  const toks = raw ? raw.split(/\s+/).filter(Boolean) : []
  for (const t of toks) {
    if (!SAFE_TOKEN_RE.test(t)) throw new Error('logcat 参数含非法字符：' + t)
  }
  return toks
}

export function safePid(pid) {
  const s = String(pid == null ? '' : pid).trim()
  if (!s) return ''
  if (!PID_RE.test(s) || Number(s) <= 0) throw new Error('PID 非法：' + s)
  return s
}

export function safeDevicePath(p) {
  const s = String(p || '')
  if (!SAFE_DEVICE_PATH_RE.test(s) || s.includes('..')) throw new Error('设备路径非法：' + s)
  return s
}

export function sq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

export function suWrap(cmdStr) {
  return ['su', '-c', "'" + String(cmdStr).replace(/'/g, "'\\''") + "'"]
}
