// 共享状态：统一「结果弹窗」+ 非阻断式「进行中」指示器
// 历史实现把各操作的成功/失败文本写进状态栏 lastMsg：字小、单行省略、不可选中复制。
// 现所有结果性文字一律走 showResult -> ResultModal（文本可选中 + 一键复制）；
// 状态栏 lastMsg 只保留「进行中 / 瞬时状态」提示（如录屏中、连续截图中）。
import { ref } from 'vue'

// ---- 结果弹窗 ----
export const resultOpen = ref(false)
export const resultTitle = ref('')
export const resultText = ref('')
export const resultOk = ref(true)

// 轮询型任务（service/process/thread/activity/getprop）失败会每几秒重复一次，
// 若每次都弹窗会不断抢占焦点。按 dedupe key + 文本去重，冷却期内只弹一次。
const lastShown = new Map()

/**
 * 展示一条操作结果。
 * @param {string} title 操作名（如「安装 APK」）
 * @param {string} text  结果正文，可选中复制；建议含命令、exit code、stdout/stderr
 * @param {boolean} ok   成功 / 失败，决定弹窗徽标与配色
 * @param {{dedupe?: string, cooldownMs?: number}} [opts] 高頻调用方的去重配置
 */
export function showResult(title, text, ok = true, opts = {}) {
  const body = String(text ?? '')
  if (opts.dedupe) {
    const key = opts.dedupe + '|' + body
    const now = Date.now()
    if (now - (lastShown.get(key) || 0) < (opts.cooldownMs || 15000)) return
    lastShown.set(key, now)
  }
  resultTitle.value = String(title || '操作结果')
  resultText.value = body
  resultOk.value = ok !== false
  resultOpen.value = true
}

export function closeResult() { resultOpen.value = false }

// ---- 非阻断式「进行中」指示器 ----
// 该浮层 CSS 为 pointer-events:none，不使用 modal-mask，不拦截/遮挡任何后台元素。
// 用计数支持并发任务，避免 A 任务结束时把 B 任务的指示器一起关掉。
export const busy = ref(false)
export const busyText = ref('')
let busyCount = 0

export function beginBusy(text) {
  busyCount += 1
  busyText.value = String(text || '处理中…')
  busy.value = true
}

export function endBusy() {
  busyCount = Math.max(0, busyCount - 1)
  if (busyCount === 0) busy.value = false
}
