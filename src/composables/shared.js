// 共享纯函数层：无状态、无 Vue 依赖，任何域模块/composable 都可导入（最低层，禁止反向导入 state）

export const pad2 = (n) => String(n).padStart(2, '0')

export const ymd = (d) => '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate())

export const ymdhms = (d) => ymd(d) + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds())

// 导出文件名统一时间戳（本地时间，精确到秒）
export const exportTs = () => ymdhms(new Date())

// 纯文本查找转正则时的转义（findPattern 等用）
export function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

// 字节数 → MB（进程表 VSZ/IO 列）
export const fmtMB = (bytes) => (bytes / 1048576).toFixed(1)

// 内存页数 → MB（进程表 RSS 列）
export const fmtRss = (pages) => (pages * 4096 / 1048576).toFixed(1)

// serial 可能含 ':'（网络地址）或 '/'，sanitized 避免非法路径/文件名字符
export function sanitizeSerial(s) { return (s || '').replace(/[^a-z0-9._-]/gi, '_') }

// Tag 转义：快筛生成「Tag 包含」正则 ^(a|b|c)$ 时按 | 切分安全，需转义 Tag 内的正则元字符
export function escapeRegexTag(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function unescapeRegexTag(s) {
  return s.replace(/\\([.*+?^${}()|[\]\\])/g, '$1')
}

// 结果弹窗正文：把 adb 子进程的 exit code / stdout / stderr 一起带上，方便复制排查。
// cmd 可选，传入时首行写成可复用的 "$ adb ..." 命令行。
export function cmdDetail(r, cmd) {
  const lines = []
  if (cmd) lines.push('$ ' + cmd)
  lines.push('[exit ' + (r ? r.code : '?') + ']')
  if (r && r.out) lines.push(String(r.out).trim())
  if (r && r.err) lines.push(String(r.err).trim())
  return lines.join('\n')
}

// 侧栏宽度（px）：默认 208，可拖拽范围 160~480。与主进程 main/config.js 的同名归一化同规则。
export const DEFAULT_SIDEBAR_WIDTH = 208
export const SIDEBAR_MIN_WIDTH = 160
export const SIDEBAR_MAX_WIDTH = 480
export function normalizeSidebarWidth(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return DEFAULT_SIDEBAR_WIDTH
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, Math.round(n)))
}

// 包名排序：android./com.android. 系统类沉底，其余升序（进程包名下拉与已装应用列表共用）
export function sortPkgs(list) {
  return list.slice().sort((a, b) => {
    const sa = (a.pkg.startsWith('android.') || a.pkg.startsWith('com.android.')) ? 1 : 0
    const sb = (b.pkg.startsWith('android.') || b.pkg.startsWith('com.android.')) ? 1 : 0
    if (sa !== sb) return sa - sb
    return a.pkg.localeCompare(b.pkg)
  })
}

// 取当前折叠选区的像素矩形（viewport 坐标）。折叠选区直接 getBoundingClientRect 在本环境
// 会返回全 0 矩形（top/left/width/height 均为 0），导致据此定位视觉光标 / 滚动使其入视时算错。
// 这里构造一个覆盖光标所处字符的临时非折叠 Range 取其可靠矩形（只创建 Range 对象，不改 DOM，
// 也不动真实选区），避免折叠选区矩形不可靠；若光标处于换行符等不可见字符则改取上一字符兜底。
export function getCaretRect() {
  const sel = window.getSelection && window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!r.collapsed) return r.getBoundingClientRect()
  const node = r.startContainer
  if (node && node.nodeType === 3) {
    const len = node.textContent ? node.textContent.length : 0
    if (len > 0) {
      const probe = document.createRange()
      let start = r.startOffset
      let end = start + 1
      if (end > len) { start = len - 1; end = len }
      if (start < 0) start = 0
      try {
        probe.setStart(node, start)
        probe.setEnd(node, end)
        let rect = probe.getBoundingClientRect()
        // 下一字符不可见（如换行符），改取上一字符矩形兜底
        if ((!rect || (rect.width === 0 && rect.height === 0)) && start > 0) {
          probe.setStart(node, start - 1)
          probe.setEnd(node, start)
          rect = probe.getBoundingClientRect()
        }
        if (rect && (rect.width || rect.height || rect.top || rect.left)) return rect
      } catch (_) {}
    }
  }
  return r.getBoundingClientRect()
}
