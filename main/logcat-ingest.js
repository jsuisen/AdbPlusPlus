// Logcat 行解析与流式归并：纯函数模块，不依赖 electron，可被 node:test 直接覆盖。
// main/logcat.js 只负责 spawn / IPC / 定时器，副作用（进程刷新事件）经回调注入本模块。
import { StringDecoder } from 'node:string_decoder'

export const LINE_RE = /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.*?):\s?(.*)$/
const PROC_EVENT_RE = /ActivityManager:.*?(Start proc|has died|Killing \d+)/i

export function parseLine(raw) {
  const m = LINE_RE.exec(raw)
  if (!m) return null
  return {
    date: m[1], time: m[2], pid: Number(m[3]), tid: Number(m[4]),
    level: m[5], tag: m[6], msg: m[7], raw
  }
}

// 字节流 -> 完整行。
// StringDecoder：UTF-8 多字节字符跨 chunk 时不会被换成 U+FFFD（中文乱码）。
// leftover：一行日志跨 chunk 时不会从中间被劈成「半行 + 折行」两条。
export function createLineReader() {
  const decoder = new StringDecoder('utf8')
  let leftover = ''
  return {
    feed(chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      const text = leftover + decoder.write(buf)
      const parts = text.split(/\r?\n/)
      leftover = parts.pop() ?? ''   // 末段可能是不完整的行，留到下一次 feed
      // 部分设备（如 Android 4.4 创维经网络 adb）行尾为 \r\r\n，split(/\r?\n/) 只消耗一个 \r，
      // 残留的 \r 会让 parseLine 的 (.*)$ 失配（JS 里 . 不匹配 \r、无 m 标志的 $ 也不在 \r 前匹配），
      // 导致整行被判为「非日志行」丢弃、日志窗口空白。在唯一入口统一剥掉行尾残留 \r，
      // 同时避免 \r 污染 msg（导出 / 自动写盘 / 查找）。leftover 不处理：它可能正好以 \r 结尾，
      // 而真正的 \n 在下一个 chunk 才到。
      return parts.map((p) => p.replace(/\r+$/, ''))
    },
    // 会话结束：交出尚未以换行结尾的最后一行（可能为空）
    end() {
      const tail = leftover + decoder.end()
      leftover = ''
      return tail ? [tail.replace(/\r+$/, '')] : []
    }
  }
}

function metaOf(line) {
  return { date: line.date, time: line.time, pid: line.pid, tid: line.tid, level: line.level, tag: line.tag }
}

function appendContinuation(line, raw) {
  line.msg += '\n' + raw
  line.raw += '\n' + raw
}

// 会话状态：buffer 历史环缓冲 / pending 批量待推送 / openLine 最近产出的行。
export function createIngestState(maxBuffer = 200000) {
  return { buffer: [], pending: [], openLine: null, maxBuffer }
}

// 处理一批「完整行」，返回本批新进 pending 的行数（供调用方决定是否起 flush 定时器）。
export function ingestLines(state, lines, onProcChanged = () => {}) {
  let added = 0
  for (const raw of lines) {
    if (!raw) continue
    if (PROC_EVENT_RE.test(raw)) onProcChanged()
    const parsed = parseLine(raw)
    if (parsed) {
      state.buffer.push(parsed)
      state.pending.push(parsed)
      state.openLine = parsed
      added++
      continue
    }
    if (!state.openLine) continue

    const tailPending = state.pending[state.pending.length - 1]
    if (tailPending && tailPending === state.openLine) {
      // buffer 与 pending 存的是同一对象引用，只追加一次。
      // 旧实现分别对 tail / tailPending 各追加一次，导致每条续行显示两遍。
      appendContinuation(state.openLine, raw)
    } else {
      // 该行已随上一次 flush 推送出去：构造一条继承元数据的独立续行。
      // 代价是跨 flush 窗口的折行在 UI 上拆成两行，但内容不丢、不重复、不乱码
      // （旧实现此分支 tailPending 为 undefined，续行只写 buffer，前端永远收不到）。
      const cont = { ...metaOf(state.openLine), msg: raw, raw }
      state.buffer.push(cont)
      state.pending.push(cont)
      state.openLine = cont
      added++
    }
  }
  if (state.buffer.length > state.maxBuffer) {
    state.buffer = state.buffer.slice(state.buffer.length - state.maxBuffer)
  }
  return added
}
