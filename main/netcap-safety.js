// 设备端命令安全边界。
// 本机用参数数组 spawn 只保证「不经本机 shell」；adbd 收到 adb shell 的参数后仍会拼成字符串
// 交给 /system/bin/sh -c（su -c 还会再套一层 sh），因此所有用户可控 token 必须先过白名单。
// 本模块不依赖 electron，可被 node:test 直接覆盖。

// 允许的 tcpdump token：选项（--foo / -vv）或字面量值 / 过滤表达式片段。
// 刻意排除 shell 元字符与复杂 BPF 语法（如 tcp[13] & 2 != 0）：被拒时向用户抛明确错误，
// 而不是靠字符黑名单去猜「哪些字符危险」。
const SAFE_TOKEN_RE = /^(?:--?[A-Za-z0-9][A-Za-z0-9-]*|[A-Za-z0-9][A-Za-z0-9._:/,=-]*)$/
const SAFE_DEVICE_PATH_RE = /^\/[A-Za-z0-9._/-]*$/

export function safeTokens(args) {
  const raw = args == null ? '' : String(args).trim()
  const toks = raw ? raw.split(/\s+/).filter(Boolean) : []
  for (const t of toks) {
    if (!SAFE_TOKEN_RE.test(t)) throw new Error('tcpdump 参数含非法字符：' + t)
  }
  return toks
}

export function safeDevicePath(p) {
  const s = String(p || '')
  if (!SAFE_DEVICE_PATH_RE.test(s) || s.includes('..')) throw new Error('设备路径非法：' + s)
  return s
}

// 单引号包裹，防路径在设备端被拆词（白名单已排除空格，此处为纵深防御）
export function sq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'"
}

// 以 root 运行设备内命令：整条命令串用单引号包住。
// 旧实现用双引号，设备端 sh 会在双引号内展开 $() / 反引号 / 变量 —— 这是注入面之一。
// 单引号内不展开；内部单引号用 '\'' 序列转义。
export function suWrap(cmdStr) {
  return ['su', '-c', "'" + String(cmdStr).replace(/'/g, "'\\''") + "'"]
}
