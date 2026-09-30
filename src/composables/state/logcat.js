// 共享状态：logcat 域（日志缓冲与分桶 / 过滤 computed / 快筛 / 查找窗口 / 注释 / 自动保存 / 日志格式）
import { ref, reactive, computed } from 'vue'
import { activeLogSerial } from './devices.js'
import { cfg } from './core.js'
import { escapeRegExp } from '../shared.js'

// 内存中保留的日志行上限（单设备）
export const MAX_BUFFER = 50000

// 渲染层最多绘制的行（过滤后取尾部）；可被配置 maxRender 覆盖（见设置-通用）
export const DEFAULT_MAX_RENDER = 20000

// 多设备并行：日志/运行状态/进程列表全部按 serial 分桶
export const logsMap = reactive({})   // serial -> 设备日志行数组
// 用户注释（仅新增，不修改/不删除设备日志，类比 AS Logcat）：serial -> [{ id, kind:'note', text, anchorId, editing }]
// anchorId 锚定到某条设备日志的 id，决定注释插入位置；锚定的设备行被缓冲截断则注释落到末尾
export const notesMap = reactive({})
export const scrollPosMap = {}        // serial -> 日志滚动位置（切换设备时按设备记忆 / 恢复）
export let _logSeq = 0
export const nextLogId = () => 'l_' + (++_logSeq)
export let _noteSeq = 0
export const nextNoteId = () => 'n_' + (++_noteSeq)
export const runningMap = reactive({}) // serial -> 是否采集中
export const logErrMap = reactive({})  // serial -> 错误信息
export const procsMap = reactive({})   // serial -> 进程列表

export const LOG_FILTER_DEFAULTS = () => ({ level: '', pkg: '', tag: '', regex: false, text: '', autoscroll: true, wrap: false })

export const _logFilter = reactive({})   // serial -> 过滤状态对象

// 过滤状态按 serial 惰性创建：state 层的过滤 computed 写入与 logcat 采集侧共用
export function ensureLogFilter(serial) {
  if (serial && !_logFilter[serial]) _logFilter[serial] = LOG_FILTER_DEFAULTS()
  return _logFilter[serial]
}

// 读时回落默认（不创建，避免 computed 副作用）；写时按当前查看设备落地
export const levelFilter = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].level : ''),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).level = v }
})

export const tagFilter = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].tag : ''),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).tag = v }
})

export const textFilter = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].text : ''),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).text = v }
})

export const autoscroll = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].autoscroll : true),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).autoscroll = v }
})

export const wrapLines = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].wrap : false),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).wrap = v }
})

export const regexFilter = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].regex : false),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).regex = v }
})

export const selectedProc = computed({
  get: () => (activeLogSerial.value && _logFilter[activeLogSerial.value] ? _logFilter[activeLogSerial.value].pkg : ''),
  set: (v) => { const s = activeLogSerial.value; if (s) ensureLogFilter(s).pkg = v }
})

export const procs = computed(() => procsMap[activeLogSerial.value] || [])

export const pidPkgMap = computed(() => {
  const m = {}
  for (const p of (procsMap[activeLogSerial.value] || [])) m[String(p.pid)] = p.pkg
  return m
})

export const logEl = ref(null)

export const editingNoteId = ref(null)

export const LEVEL_PRI = { V: 0, D: 1, I: 2, W: 3, E: 4, F: 5 }

export const displayLogs = computed(() => {
  const lvl = levelFilter.value
  const tag = tagFilter.value.trim().toLowerCase()
  const txt = textFilter.value.trim()
  let arr = logsMap[activeLogSerial.value] || []
  if (lvl) arr = arr.filter((l) => (LEVEL_PRI[l.level] ?? 0) >= LEVEL_PRI[lvl])
  if (tag) arr = arr.filter((l) => (l.tag || '').toLowerCase().includes(tag))
  if (txt) {
    if (regexFilter.value) {
      // Regex 模式：关键字过滤按正则匹配消息内容（i 不区分大小写）；非法正则则忽略，避免误隐藏
      try {
        const re = new RegExp(txt, 'i')
        // 同时匹配 消息内容 与 标签（标签作为独立字段），以便「快筛」按 Tag 生成的正则能正确过滤
        arr = arr.filter((l) => re.test(l.msg || '') || re.test(l.tag || ''))
      } catch { /* 非法正则：保持不过滤 */ }
    } else {
      const t = txt.toLowerCase()
      arr = arr.filter((l) => (l.msg || '').toLowerCase().includes(t))
    }
  }
  // 进程包名过滤：仅保留 pid 映射到所选包名的日志（pid->pkg 取自当前查看设备）
  const pkg = selectedProc.value
  if (pkg) {
    const m = pidPkgMap.value
    arr = arr.filter((l) => m[String(l.pid)] === pkg)
  }
  const maxRender = cfg.value.maxRender ?? DEFAULT_MAX_RENDER
  if (arr.length > maxRender) arr = arr.slice(arr.length - maxRender)
  return arr
})

export const mergedView = computed(() => {
  const dev = displayLogs.value
  const notes = notesMap[activeLogSerial.value] || []
  if (!notes.length) return dev
  const placed = new Set()
  const out = []
  for (const l of dev) {
    out.push(l)
    for (const n of notes) if (n.anchorId === l.id) { out.push(n); placed.add(n.id) }
  }
  for (const n of notes) if (!placed.has(n.id)) out.push(n)
  return out
})

export const currentRunning = computed(() => !!runningMap[activeLogSerial.value])

export const currentLogErr = computed(() => logErrMap[activeLogSerial.value] || '')

// ---------- 快筛：Tag 快速过滤 ----------
export const qfOpen = ref(false)

export const qfTags = ref([])

export const qfAllChecked = computed(() => qfTags.value.length > 0 && qfTags.value.every((t) => t.checked))

export const qfSearch = ref('')

export const qfTagsFiltered = computed(() => {
  const q = qfSearch.value.trim().toLowerCase()
  if (!q) return qfTags.value
  return qfTags.value.filter((t) => t.tag.toLowerCase().includes(q))
})

// ---------- 自动写日志（异步落盘，按设备分文件） ----------
export const autoLog = ref(false)          // 设置开关：是否自动写日志
export const autoLogBufMap = reactive({}) // serial -> 待写入行的文本缓冲（已 fmtLineOf 格式化）
export const autoLogMeta = {}             // serial -> { day, ts, path }（非响应式，仅日期滚动用）

// ---------- 日志格式 ----------
export const logFmt = reactive({ date: true, pid: true, pkg: true, tag: true })

export const fmtModalOpen = ref(false)

export const fmtDraft = reactive({ date: true, pid: true, pkg: true, tag: true })

export const SAMPLE_LOG = { date: '2018-02-07', time: '06:16:28.555', pid: 123, tid: 456, pkg: 'com.android.sample', level: 'I', tag: 'SampleTag', msg: 'This is a sample message' }

export const exampleText = computed(() => {
  const segs = []
  if (fmtDraft.date) segs.push(SAMPLE_LOG.date + ' ' + SAMPLE_LOG.time)
  let ident = ''
  if (fmtDraft.pid) ident = `${SAMPLE_LOG.pid}-${SAMPLE_LOG.tid}`
  if (fmtDraft.pkg) ident += (fmtDraft.pid ? '/' : '') + SAMPLE_LOG.pkg
  if (ident) segs.push(ident)
  const pre = segs.join(' ') + (segs.length ? ' ' : '')
  const post = (fmtDraft.tag ? '/' + SAMPLE_LOG.tag : '') + ':' + SAMPLE_LOG.msg
  return pre + SAMPLE_LOG.level + post
})

// ---------- 日志区右键菜单 ----------
export const ctxMenu = reactive({ visible: false, x: 0, y: 0, text: '' })

// ---------- 查找窗口 ----------
export const findOpen = ref(false)

export const findEl = ref(null)

export const findTargetInput = ref(null)

export const findDraft = reactive({
  target: '',            // 查找目标
  backward: false,       // 反向查找：反转「查找上一个 / 下一个」的方向
  wholeWord: false,      // 全词匹配（普通模式按 \b 包裹，即只命中独立单词）
  matchCase: false,      // 匹配大小写
  wrap: true,            // 循环查找：到头后从另一端继续
  mode: 'normal',        // 'normal' 普通 | 'regex' 正则表达式
  dotAll: false,         // 正则模式下 . 是否匹配换行符
  transparent: false,    // 透明度开关
  transMode: 'blur',     // 'blur' 失去焦点后 | 'always' 始终
  transValue: 90         // 不透明度百分比 20~100
})

export const findHistory = ref([])

export const findSnap = ref(null)

export const findIndex = ref(-1)

export const findBox = ref('')

export const findFocused = ref(false)

export const findPos = reactive({ x: 40, y: 90, ready: false })

export const findSize = reactive({ w: 660, h: 0 })

export const findPattern = computed(() => {
  const t = findDraft.target
  if (!t) return { re: null, err: '' }
  try {
    const flags = (findDraft.matchCase ? '' : 'i') + 'g' + (findDraft.mode === 'regex' && findDraft.dotAll ? 's' : '')
    const body = findDraft.mode === 'regex'
      ? t
      : (findDraft.wholeWord ? '\\b' + escapeRegExp(t) + '\\b' : escapeRegExp(t))
    return { re: new RegExp(body, flags), err: '' }
  } catch (e) {
    return { re: null, err: '正则表达式无效：' + e.message }
  }
})

export const findPatternError = computed(() => findPattern.value.err)

export const findMatches = computed(() => {
  const p = findPattern.value
  const snap = findSnap.value
  const out = []
  if (!p.re || !snap) return out
  for (const ln of snap.lines) {
    let li = 0
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(ln.text)) !== null) {
      out.push({ lineId: ln.id, li: li++, start: m.index, end: m.index + m[0].length })
      if (m[0] === '') p.re.lastIndex++    // 零长度匹配：强制前进，避免死循环
      if (out.length > 200000) break       // 极端情况（如 .* 之类）兜底封顶
    }
    if (out.length > 200000) break
  }
  return out
})

export const findHitsByLine = computed(() => {
  const m = new Map()
  for (const h of findMatches.value) {
    let a = m.get(h.lineId)
    if (!a) { a = []; m.set(h.lineId, a) }
    a.push({ start: h.start, end: h.end, li: h.li })
  }
  return m
})

export const findCur = computed(() => findMatches.value[findIndex.value] || null)

export const findWinStyle = computed(() => {
  let op = 1
  if (findDraft.transparent) {
    const v = Math.min(100, Math.max(20, Number(findDraft.transValue) || 100)) / 100
    op = findDraft.transMode === 'always' ? v : (findFocused.value ? 1 : v)
  }
  const s = { left: findPos.x + 'px', top: findPos.y + 'px', opacity: op, width: findSize.w + 'px' }
  if (findSize.h) s.height = findSize.h + 'px'
  return s
})

export let _noteSaveTimers = {}
