// 共享状态：统一「结果弹窗」+ 非阻断式「进行中」指示器
// 历史实现把各操作的成功/失败文本写进状态栏 lastMsg：字小、单行省略、不可选中复制。
// 现所有结果性文字一律走 showResult -> ResultModal（文本可选中 + 一键复制）；
// 状态栏 lastMsg 只保留「进行中 / 瞬时状态」提示（如录屏中、连续截图中）。
import { ref } from 'vue'
import { t } from '@/i18n'

// ---- 结果弹窗（队列） ----
// resultOpen/Title/Text/Ok 是「当前显示项」，ResultModal 只读这四个 ref。
// 并发任务同时完成时，后完成的结果不再覆盖前一个，而是入队；关闭当前后依次弹出。
export const resultOpen = ref(false)
export const resultTitle = ref('')
export const resultText = ref('')
export const resultOk = ref(true)

// 普通数组即可：仅由 showResult/closeResult 同步读写，不进模板。
const resultQueue = []

function pumpResult() {
  if (resultOpen.value) return
  const next = resultQueue.shift()
  if (!next) return
  resultTitle.value = next.title
  resultText.value = next.text
  resultOk.value = next.ok
  resultOpen.value = true
}

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
  resultQueue.push({ title: String(title || t('result.title')), text: body, ok: ok !== false })
  pumpResult()
}

export function closeResult() {
  resultOpen.value = false
  pumpResult()   // 关闭当前后立即弹出下一条；队列空则保持关闭
}

// 供诊断/测试读取待显示数量，渲染层无需响应式（仅控制台与单测用）
export function pendingResultCount() { return resultQueue.length }

// ---- 非阻断式「进行中」指示器 ----
// 该浮层 CSS 为 pointer-events:none，不使用 modal-mask，不拦截/遮挡任何后台元素。
// 用计数支持并发任务，避免 A 任务结束时把 B 任务的指示器一起关掉。
export const busy = ref(false)
export const busyText = ref('')
let busyCount = 0

export function beginBusy(text) {
  busyCount += 1
  busyText.value = String(text || t('busy.processing'))
  busy.value = true
}

export function endBusy() {
  busyCount = Math.max(0, busyCount - 1)
  if (busyCount === 0) busy.value = false
}

// ---- 阻断式「进行中」遮罩 ----
// 用于日志导出这类必须独占界面的操作：遮罩拦截所有鼠标/键盘输入，直到操作结束。
export const blockingBusy = ref(false)
export const blockingBusyText = ref('')
let blockingBusyCount = 0

export function beginBlockingBusy(text) {
  blockingBusyCount += 1
  blockingBusyText.value = String(text || t('busy.processing'))
  blockingBusy.value = true
}

export function endBlockingBusy() {
  blockingBusyCount = Math.max(0, blockingBusyCount - 1)
  if (blockingBusyCount === 0) blockingBusy.value = false
}
