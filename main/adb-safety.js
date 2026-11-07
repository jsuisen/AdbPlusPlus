// adb shell 参数安全边界。
// adbd 收到 adb shell 的参数后会拼成命令串交给 /system/bin/sh -c，
// 因此「本机用参数数组 spawn」不等于设备端安全。
// 标识符类走白名单，自由文本类用单引号包成 shell 字面量，数值类只放整数。
// 本模块不依赖 electron，可被 node:test 直接覆盖。
const ADB_IDENT_RE = /^[A-Za-z0-9_./:-]+$/
const ADB_NUM_RE = /^-?\d+$/

export function assertIdent(v, label = '参数') {
  const s = String(v == null ? '' : v).trim()
  if (!ADB_IDENT_RE.test(s)) throw new Error(label + ' 含非法字符：' + s)
  return s
}

export function shellLiteral(v) {
  return "'" + String(v == null ? '' : v).replace(/'/g, "'\\''") + "'"
}

export function safeServiceTokens(v) {
  const toks = String(v == null ? '' : v).trim().split(/\s+/).filter(Boolean)
  for (const t of toks) assertIdent(t, 'dumpsys service')
  return toks
}

export function assertNum(v, label = '数值') {
  const s = String(v == null ? '' : v).trim()
  if (!ADB_NUM_RE.test(s)) throw new Error(label + ' 必须是整数：' + s)
  return s
}
