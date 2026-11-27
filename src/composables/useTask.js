// 统一任务包装器：把「进行中动画 + 同 key 防重 + 分级结果通知」收敛到一处。
// 目的：所有用户主动触发的下载/导出/保存走同一套语义，杜绝「点了没反应」「连点重复落盘」。
// 依赖方向：useTask -> state（桶）+ useUi.toast；useUi 不 import useTask，无环。
import { t } from '@/i18n'
import { beginBusy, endBusy, lastMsg, showResult } from './state'
import { toast } from './useUi'

// 同 key 正在执行的任务集合。key 由调用方给（如 'file:pull'、'capture:<path>'），
// 同 key 重复触发直接吞掉；不同 key 并发互不影响，busy 用 beginBusy 的计数器支持并发。
const activeKeys = new Set()

/**
 * 执行一个任务并统一处理进行中反馈与结果通知。
 * @param {object} o
 * @param {string} o.key       防重键；同一 key 在执行中时重复调用返回 false，不重复执行
 * @param {string} o.label     操作名，用于 modal 标题 / 失败文案的主语
 * @param {Function} o.task    实际任务，返回 { ok, text, level?, dedupe?, cooldownMs? } 或字符串
 *                             text 为完整结果文案（含路径/命令详情）；抛异常时由本函数兜底
 * @param {boolean} [o.busy]   是否显示非阻断进行中浮层，默认 true
 * @param {string}  [o.busyText] 浮层文字；不传则用 label
 * @returns {Promise<boolean>} true=执行完成；false=被防重吞掉
 */
async function runTask({ key, label, task, busy = true, busyText }) {
  if (key && activeKeys.has(key)) return false
  if (key) activeKeys.add(key)
  if (busy) beginBusy(busyText || label)
  try {
    const r = await task()
    const out = normalize(r)
    notify(label, out)
  } catch (e) {
    // 兜底异常用统一模板，参数化避免手拼；失败也走同一套通知级别
    notify(label, { ok: false, text: t('result.error', { label, err: e && e.message ? e.message : String(e) }) })
  } finally {
    if (busy) endBusy()
    if (key) activeKeys.delete(key)
  }
  return true
}

// task 返回值归一：字符串视为成功文案；对象补齐 ok/level
function normalize(r) {
  if (typeof r === 'string' || r == null) return { ok: true, text: String(r ?? ''), level: 'modal' }
  return {
    ok: r.ok !== false,
    text: String(r.text ?? ''),
    level: r.level || 'modal',
    dedupe: r.dedupe,
    cooldownMs: r.cooldownMs
  }
}

// 分级通知：
//   modal  -> showResult 队列弹窗（重要结果、含命令详情需复制）
//   toast  -> 1.6 秒自动消失（轻量成功/失败）
//   status -> 仅写状态栏（连续/高频，如逐张截图）
//   silent -> 完全静默（后台写盘）
// 文本为空时不通知，避免空弹窗。
function notify(label, out) {
  if (!out.text) return
  const level = out.level || 'modal'
  if (level === 'silent') return
  if (level === 'status') { lastMsg.value = out.text; return }
  if (level === 'toast') { toast(out.text); return }
  showResult(label, out.text, out.ok, { dedupe: out.dedupe, cooldownMs: out.cooldownMs })
}

export function useTask() {
  return { runTask }
}
export { runTask }
