// 由 split_app2.cjs 自动拆分生成（logcat）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {MAX_BUFFER, _noteSaveTimers, activeLogSerial, api, appLogEnabled, appPkg, autoLog, autoLogBufMap, autoLogMeta, autoscroll, cfg, ctxMenu, deviceLabel, displayLogs, editingNoteId, ensureLogFilter, escapeRegExp, findBox, findCur, findDraft, findEl, findFocused, findHistory, findHitsByLine, findIndex, findMatches, findOpen, findPos, findSize, findSnap, findTargetInput, fmtDraft, fmtModalOpen, lastMsg, logEl, logErrMap, logFmt, logsMap, mergedView, nextLogId, nextNoteId, notesMap, pidPkgMap, procsMap, qfOpen, qfTags, regexFilter, runningMap, scrollPosMap, selectedProc, tagFilter, textFilter, ymd, ymdhms} from './state'
import { escapeRegexTag, getCaretRect, sanitizeSerial, sortPkgs, unescapeRegexTag } from './shared'
import { toast } from './useUi'
import { saveCfg } from './useConfig'

function clearKeywordFilter() {
  textFilter.value = ''
  regexFilter.value = false
}

function clearTagFilter() {
  tagFilter.value = ''
}

function onLogScrollSave() {
  const s = activeLogSerial.value
  if (!s || !logEl.value) return
  scrollPosMap[s] = logEl.value.scrollTop
  if (autoscroll.value && !suppressScrollCancel && !editingNoteId.value) {
    const el = logEl.value
    const atBottomNow = el.scrollHeight - el.scrollTop - el.clientHeight < 4
    if (!atBottomNow) autoscroll.value = false
  }
}

function onLogMouseDown(e) {
  if (e.button !== 0) return   // 仅左键；右键菜单等不取消
  autoscroll.value = false
}

function onData(payload) {
  const serial = payload.serial
  let arr = logsMap[serial]
  if (!arr) { arr = []; logsMap[serial] = arr }
  for (const l of payload.batch) { l.id = nextLogId(); l.kind = 'log'; arr.push(l) }
  if (arr.length > MAX_BUFFER) arr.splice(0, arr.length - MAX_BUFFER)
  onDataAutoLog(payload.batch, serial)
}

function startLogcat(serial) {
  if (!serial) return
  logErrMap[serial] = ''
  if (!logsMap[serial]) logsMap[serial] = []
  api.send('logcat:start', { serial, buffers: ['main', 'system', 'crash'] })
  runningMap[serial] = true
  if (autoLog.value) applyAutoLog(serial)
}

function stopLogcat(serial) {
  if (!serial) return
  api.send('logcat:stop', serial)
  runningMap[serial] = false
  if (autoLog.value) applyAutoLog(serial)
}

function toggleLogcat() {
  const s = activeLogSerial.value
  if (!s) return
  if (runningMap[s]) stopLogcat(s)
  else startLogcat(s)
}

function clearLogs() {
  const s = activeLogSerial.value
  if (!s) return
  logsMap[s] = []
  notesMap[s] = []
}

function collectTagStats() {
  const arr = logsMap[activeLogSerial.value] || []
  const m = new Map()
  for (const l of arr) {
    const raw = l.tag || ''
    if (!raw.trim()) continue                       // 仅跳过空白/空 Tag
    m.set(raw, (m.get(raw) || 0) + 1)               // 用「原始 Tag」计数：与过滤时 re.test(l.tag) 完全一致，
                                                    // 避免 trim 后生成的正则匹配不到原始 Tag（如 Tag 带尾随空格导致全部被隐藏）
  }
  const list = [...m.entries()].map(([tag, count]) => ({ tag, count, checked: true }))
  list.sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  return list
}

function openQuickFilter() {
  if (!activeLogSerial.value) { toast('请先选择设备并开始采集日志'); return }
  qfTags.value = collectTagStats()
  syncCheckFromRegex()
  qfOpen.value = true
}

function syncCheckFromRegex() {
  const txt = textFilter.value.trim()
  if (!regexFilter.value || !txt) return
  // 固定结构：以 "^(" 开头、")" 结尾。去掉首尾固定的 "^(" 与 ")$" 后，内部为「转义后的 Tag 用 | 连接」。
  // 此前用正则 /^\^\((.*)\)$/ 解析在实测中始终匹配失败（导致重开窗口勾选态恒为全勾、无法反映真实过滤），
  // 故改用结构切分，稳定可靠；内部转义括号不影响首尾定位（slice 只取最外两层）。
  if (!txt.startsWith('^(') || !txt.endsWith(')$')) return
  const inner = txt.slice(2, -2)
  const allowed = new Set(inner.split('|').map(unescapeRegexTag).filter(Boolean))
  for (const t of qfTags.value) t.checked = allowed.has(t.tag)
}

function closeQuickFilter() {
  commitQuickFilter()
}

function commitQuickFilter() {
  const list = qfTags.value
  const unchecked = list.filter((t) => !t.checked)
  if (unchecked.length === 0) {
    // 没有需要排除的 Tag：清空快筛产生的正则，恢复正常显示（不影响级别/包名/关键字等其它过滤条件）
    textFilter.value = ''
    regexFilter.value = false
  } else {
    const checked = list.filter((t) => t.checked).map((t) => t.tag)
    const pat = '^(' + checked.map(escapeRegexTag).join('|') + ')$'
    textFilter.value = pat
    regexFilter.value = true
  }
  qfOpen.value = false
}

function resetQf() {
  for (const t of qfTags.value) t.checked = true
}

function invertQf() {
  for (const t of qfTags.value) t.checked = !t.checked
}

function toggleAllQf(e) {
  const v = e.target.checked
  for (const t of qfTags.value) t.checked = v
}

function ensureAutoLogPath(serial) {
  const now = new Date()
  const day = ymd(now)
  const m = autoLogMeta[serial]
  if (!m || m.day !== day) {
    const ts = ymdhms(now)
    autoLogMeta[serial] = { day, ts, path: (cfg.value.outDir || '') + '/logcat_' + deviceLabel(serial) + '_' + ts + '.log' }
  }
  return autoLogMeta[serial].path
}

async function flushAutoLog(serial, backfill = false) {
  const buf = autoLogBufMap[serial]
  if (backfill) {
    // 激活时先把内存里已有的该设备日志补写进当天文件
    const arr = logsMap[serial] || []
    let b = autoLogBufMap[serial]
    if (!b) { b = []; autoLogBufMap[serial] = b }
    for (const l of arr) b.push(fmtLineOf(l, pidMapFor(serial)))
  }
  const arr = autoLogBufMap[serial]
  if (!arr || !arr.length) return
  const text = arr.join('\n') + '\n'
  autoLogBufMap[serial] = []
  const p = ensureAutoLogPath(serial)
  try { await api.invoke('log:append', { path: p, text }) } catch { /* 忽略写入失败 */ }
}

function startAutoLogFlush() {
  stopAutoLogFlush()
  autoLogTimer = setInterval(() => {
    for (const s in autoLogBufMap) { if (autoLogBufMap[s]?.length) flushAutoLog(s, false) }
  }, 1000)
}

function stopAutoLogFlush() {
  if (autoLogTimer) { clearInterval(autoLogTimer); autoLogTimer = null }
}

function anyAutoLogActive() {
  for (const s in runningMap) if (runningMap[s] && autoLog.value) return true
  return false
}

function applyAutoLog(serial) {
  const active = autoLog.value && runningMap[serial]
  if (active) {
    startAutoLogFlush()
    flushAutoLog(serial, true)
  } else {
    flushAutoLog(serial, false)   // 停用时把剩余缓冲落盘
    if (!anyAutoLogActive()) stopAutoLogFlush()
  }
}

function onAutoLogChange() {
  saveCfg()
  if (autoLog.value) { for (const s in runningMap) if (runningMap[s]) applyAutoLog(s) }
  else { for (const s in autoLogBufMap) flushAutoLog(s, false); stopAutoLogFlush() }
}

function onAppLogChange() {
  saveCfg()
  api.invoke('applog:set', { enabled: appLogEnabled.value, dir: cfg.value.appLogDir || '' })
}

async function browseAppLogDir() {
  const dir = await api.invoke('file:pickDir', { defaultPath: cfg.value.appLogDir || undefined })
  if (!dir) return
  cfg.value.appLogDir = dir
  saveCfg()
  if (appLogEnabled.value) api.invoke('applog:set', { enabled: true, dir })
}

function onDataAutoLog(batch, serial) {
  if (!autoLog.value) return
  let b = autoLogBufMap[serial]
  if (!b) { b = []; autoLogBufMap[serial] = b }
  for (const l of batch) b.push(fmtLineOf(l, pidMapFor(serial)))
}

function pidMapFor(serial) {
  const m = {}
  for (const p of (procsMap[serial] || [])) m[String(p.pid)] = p.pkg
  return m
}

function loadProcToPkg() {
  if (selectedProc.value) { appPkg.value = selectedProc.value; saveCfg() }
}

async function refreshProcs(serial) {
  serial = serial || activeLogSerial.value
  if (!serial) return
  try {
    const list = await api.invoke('adb:ps', { serial })
    procsMap[serial] = sortPkgs(list)
  } catch { procsMap[serial] = [] }
}

function openFmt() { Object.assign(fmtDraft, logFmt); fmtModalOpen.value = true }

function confirmFmt() { Object.assign(logFmt, fmtDraft); fmtModalOpen.value = false }

function cancelFmt() { fmtModalOpen.value = false }

function fmtLineOf(l, pidMap) {
  const segs = []
  if (logFmt.date && l.date) segs.push(l.date + ' ' + (l.time || ''))
  let ident = ''
  if (logFmt.pid) ident = `${l.pid}-${l.tid}`
  if (logFmt.pkg) {
    const p = (pidMap || pidPkgMap.value)[String(l.pid)] || ''
    if (p) ident += (logFmt.pid ? '/' : '') + p
  }
  if (ident) segs.push(ident)
  return segs.join(' ') + (segs.length ? ' ' : '') + l.level + (logFmt.tag && l.tag ? '/' + l.tag : '') + ':' + (l.msg || '')
}

function formatLogLine(l) { return fmtLineOf(l, pidPkgMap.value) }

function scrollToBottom() {
  suppressScrollCancel = true
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  nextTick(() => { suppressScrollCancel = false })
}

function scrollToTop() {
  autoscroll.value = false
  if (logEl.value) logEl.value.scrollTop = 0
}

function toggleLatest() {
  if (autoscroll.value) {
    autoscroll.value = false
    return
  }
  autoscroll.value = true
  nextTick(scrollToBottom)
}

// 最近一次落在日志区内的折叠光标位置：方向键把光标带出日志区时用它拉回
let lastCaretAnchor = null
// 判断当前折叠选区是否落在日志区内（即日志区已存在由点击放置的光标）；落在区内时记录位置备查
function selInLog() {
  const sel = window.getSelection()
  const ok = !!sel && sel.rangeCount > 0 && !!logEl.value && logEl.value.contains(sel.anchorNode)
  if (ok) {
    const r = sel.getRangeAt(0)
    lastCaretAnchor = { node: r.startContainer, offset: r.startOffset }
  }
  return ok
}
// 光标是否停在日志区内的文本节点上（.logline / .note-line 的文字）
function caretInLogText(node) {
  const el = logEl.value
  return !!node && node.nodeType === 3 && !!el && el.contains(node)
}
// 日志区已聚焦、但选区已被带出日志区（如 ↑/↓ 越界把光标送进上下方工具栏文字）时，
// 拉回最近一次落在日志区内的位置，使方向键继续驱动日志区光标
function ensureCaretInLog() {
  if (selInLog()) return true
  const el = logEl.value
  if (!el || document.activeElement !== el) return false
  const a = lastCaretAnchor
  if (!a || !a.node || !a.node.isConnected) return false
  const sel = window.getSelection()
  if (!sel) return false
  try {
    const r = document.createRange()
    r.setStart(a.node, a.offset)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
  } catch (_) { return false }
  return true
}
// 取折叠选区的锚点（文本节点 + 偏移），用于比较一次移动前后光标是否真的移动了
function caretAnchor() {
  const sel = window.getSelection()
  const r = sel.getRangeAt(0)
  return { node: r.startContainer, offset: r.startOffset }
}
// 自锚点向上找到光标所在的日志行元素（.logline）；不在任何日志行内返回 null
function lineElOf(node) {
  const el = logEl.value
  while (node && node !== el) {
    if (node.nodeType === 1 && node.classList && node.classList.contains('logline')) return node
    node = node.parentNode
  }
  return null
}
// 光标字符矩形的 top；矩形不可靠（全 0，如锚点落在无文本元素上）返回 null
function caretRectTop() {
  const r = getCaretRect()
  if (!r || (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0)) return null
  return r.top
}
// 非可编辑容器内 Selection.modify 移动光标后，浏览器不会自动滚动使其可见；
// 这里手动调整滚动量使光标入视：纵向按「光标所在日志行（.logline 元素）」的矩形判断（元素矩形始终可靠，
// 规避折叠选区矩形在本环境全 0 的问题）；横向按光标字符矩形兜底（宽行行尾超出可视宽度时
// overflow-x 不会自动横滚，防止光标被右缘裁掉不可见）。
function keepCaretVisible() {
  const el = logEl.value
  if (!el) return
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return
  const er = el.getBoundingClientRect()
  const lineEl = lineElOf(sel.anchorNode)
  let top
  let bottom
  if (lineEl) {
    const lr = lineEl.getBoundingClientRect()
    top = lr.top
    bottom = lr.bottom
  } else {
    // 极少数不在日志行内（如尾部定位区）时回退到光标矩形；取不到可靠矩形则不滚动，避免误跳
    const cr = getCaretRect()
    if (!cr || (cr.width === 0 && cr.height === 0 && cr.top === 0 && cr.left === 0)) return
    top = cr.top
    bottom = cr.bottom
  }
  if (top < er.top) el.scrollTop -= (er.top - top)
  else if (bottom > er.bottom) el.scrollTop += (bottom - er.bottom)
  // 横向兜底：光标字符矩形超出可视宽度时横滚，保证光标始终可见
  const cr = getCaretRect()
  if (cr && !(cr.width === 0 && cr.height === 0 && cr.top === 0 && cr.left === 0)) {
    const visL = er.left + el.clientLeft
    const visR = visL + el.clientWidth
    if (cr.left < visL) el.scrollLeft -= (visL - cr.left) + 20
    else if (cr.right > visR) el.scrollLeft += (cr.right - visR) + 20
  }
}

// 日志窗口「逐行」滚动的步长：取一条日志行的实际占位高度（含上下 padding），随设置里的日志字体大小自适应；
// 取不到实测高度时退回 CSS 行高，再退回 18px
function logLineStep() {
  const el = logEl.value
  if (!el) return 18
  const first = el.querySelector('.logline')
  if (first) {
    const h = first.getBoundingClientRect().height
    if (h > 0) return h
  }
  const lh = parseFloat(window.getComputedStyle(el).lineHeight)
  return isFinite(lh) && lh > 0 ? lh : 18
}
function onLogKey(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
    const el = logEl.value
    if (el) {
      e.preventDefault()
      const sel = window.getSelection()
      sel.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(el)
      sel.addRange(range)
    }
    return
  }
  // Shift+方向键：从当前光标处扩展文本选区（跨行/换行均有效）。
  // 显式调用 Selection.modify 接管，绕开非可编辑容器下原生 Shift+方向键 偶发不扩展的问题
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const gran = { ArrowLeft: ['left', 'character'], ArrowRight: ['right', 'character'], ArrowUp: ['backward', 'line'], ArrowDown: ['forward', 'line'] }
    const g = gran[e.key]
    if (g) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount) {
        e.preventDefault()
        try { sel.modify('extend', g[0], g[1]) } catch (_) {}
      }
      return
    }
  }
  // Ctrl+组合（仿 AS Logcat）：Ctrl+↑/↓ 让日志窗口逐行上下滚动、光标不动；
  // Ctrl+←/→ 让光标按「词」移动。整组不受「光标移动不滚动日志区窗口」设置影响，日志区有焦点即可用。
  if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    const el = logEl.value
    if (el && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const step = logLineStep()   // 每次一行；按住不放由键盘自动重复连续逐行滚动
      if (e.key === 'ArrowUp') el.scrollTop = Math.max(0, el.scrollTop - step)
      else el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + step)
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // 跨词移动需要日志区内已有光标；没有可移动的光标则不做拦截，交回浏览器
      if (!ensureCaretInLog()) return
      e.preventDefault()
      const sel = window.getSelection()
      const before = caretAnchor()
      try { sel.modify('move', e.key === 'ArrowLeft' ? 'left' : 'right', 'word') } catch (_) {}
      const after = caretAnchor()
      const moved = before.node !== after.node || before.offset !== after.offset
      // 词级移动同样会在日志区边界按整页 DOM 顺序越界到区外元素，检测到即回滚，保持光标留在日志区内
      if (moved && !caretInLogText(after.node)) {
        try { sel.collapse(before.node, before.offset) } catch (_) {}
      }
      keepCaretVisible()
      return
    }
  }
  // 纯方向键（无 Shift/Ctrl/Alt/Meta）：开启「光标移动不滚动日志区窗口」且日志区已存在光标时，
  // 方向键移动光标而非滚动窗口；左右到边缘自动跨行，上下到顶/底时改为滚动日志窗口一行。
  if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && cfg.value.cursorMoveNoScroll && ensureCaretInLog()) {
    const move = { ArrowLeft: ['left', 'character'], ArrowRight: ['right', 'character'], ArrowUp: ['backward', 'line'], ArrowDown: ['forward', 'line'] }
    const m = move[e.key]
    if (m) {
      e.preventDefault()
      const sel = window.getSelection()
      const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown'
      const before = caretAnchor()
      const beforeTop = vertical ? caretRectTop() : null
      try { sel.modify('move', m[0], m[1]) } catch (_) {}
      const after = caretAnchor()
      const moved = before.node !== after.node || before.offset !== after.offset
      // 越界检测：Chromium 的行级移动在日志首/末行不停在原地，而是继续按整页 DOM 顺序找下/上一行，
      // 把光标送进日志区外的邻近元素（实测 ↓ 到末行会进下方「快捷按钮」标题文字、↑ 到首行进上方工具栏），
      // 选区因此脱离日志区 → 视觉光标被判无效而隐藏、方向键退化成滚窗。故移动后光标只要不在日志区内的
      // 文本上，即视为越界：回滚锚点，按边缘处理。
      const escaped = moved && !caretInLogText(after.node)
      // 钳位检测：已在首/末行时再按 ↑/↓，Chromium 会把光标甩到该行行首/行尾（仍停在日志区内的同一可视行上，
      // 如 line1@9 → line1@0），这并非真正换行，同样回滚锚点、按边缘处理
      let clamped = escaped
      let afterTop = null
      if (!escaped && vertical && moved) {
        afterTop = caretRectTop()
        if (beforeTop !== null && afterTop !== null) clamped = Math.abs(afterTop - beforeTop) <= 1
        else clamped = lineElOf(after.node) === lineElOf(before.node)
      }
      if (moved && !clamped) {
        keepCaretVisible()
      } else {
        if (clamped) {
          try { sel.collapse(before.node, before.offset) } catch (_) {}
        }
        if (vertical) {
          // 已到文档首/末可视行，光标无法再移动：滚动日志窗口一行，便于浏览更上/更下的内容
          const el = logEl.value
          const line = 18
          if (e.key === 'ArrowUp') el.scrollTop = Math.max(0, el.scrollTop - line)
          else el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + line)
        }
        // 光标已无法再移动：仍做一次入视（含横向），把此前被裁到可视区外的光标救回视野
        keepCaretVisible()
      }
      return
    }
  }
  // 回车：在日志最下方新增一行注释并把光标移过去（类比 AS Logcat 在末尾追加输入行）；
  // 在注释输入框内按回车由 onNoteKey 处理（仅换行，不提交）
  if (e.key === 'Enter') {
    e.preventDefault()
    insertTailNote(e)
  }
}

function onLogContextMenu(e) {
  const t = e.target
  // 编辑态（注释输入框）交给浏览器原生菜单，不拦截
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
  e.preventDefault()  // 阻止原生右键菜单，保证自定义菜单一定出现
  const sel = window.getSelection()
  ctxMenu.text = sel ? sel.toString() : ''
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.visible = true
}

function copySelection() {
  if (ctxMenu.text) api.invoke('clipboard:write', { text: ctxMenu.text })
  ctxMenu.visible = false
}

function selectAllLogs() {
  const el = logEl.value
  if (el) {
    const sel = window.getSelection()
    sel.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.addRange(range)
  }
  ctxMenu.visible = false
}

function closeCtxMenu() { ctxMenu.visible = false }

function findSegsFor(e) {
  const hits = findHitsByLine.value.get(e.id)
  if (!hits || !hits.length) return null
  const text = e.kind === 'note' ? (e.text || '') : formatLogLine(e)
  const out = []
  let cur = 0
  const c = findCur.value
  for (const h of hits) {
    if (h.end > text.length) return null   // 行文本已变（如包名映射刷新），位置失效则本行不高亮
    if (h.start > cur) out.push({ t: text.slice(cur, h.start), hit: false, cur: false })
    out.push({ t: text.slice(h.start, h.end), hit: true, cur: !!c && c.lineId === e.id && c.li === h.li })
    cur = h.end
  }
  if (cur < text.length) out.push({ t: text.slice(cur), hit: false, cur: false })
  return out
}

function openFindWindow() {
  if (findOpen.value) { refreshFindScope(); focusFindInput(); return }
  findOpen.value = true
  refreshFindScope()
  focusFindInput()
}

function refreshFindScope() {
  const serial = activeLogSerial.value
  // 范围 = 日志窗口此刻显示的行：设备日志行取显示文本，用户注释行取注释文本
  const lines = mergedView.value.map((l) => ({ id: l.id, kind: l.kind, text: l.kind === 'note' ? (l.text || '') : formatLogLine(l) }))
  findSnap.value = { serial, lines }
  findIndex.value = -1
  findBox.value = ''
}

function focusFindInput() {
  nextTick(() => {
    resetFindPosOnce()
    const el = findTargetInput.value
    if (el) { el.focus(); el.select() }
  })
}

function resetFindPosOnce() {
  if (findPos.ready) return
  findPos.ready = true
  const w = findEl.value ? findEl.value.offsetWidth : 640
  const h = findEl.value ? findEl.value.offsetHeight : 320
  const r = logEl.value ? logEl.value.getBoundingClientRect() : null
  const x = r ? r.right - w - 24 : (window.innerWidth - w) / 2
  const y = r ? r.top + 16 : (window.innerHeight - h) / 3
  findPos.x = Math.max(8, Math.min(x, window.innerWidth - w - 8))
  findPos.y = Math.max(8, Math.min(y, window.innerHeight - h - 8))
}

function closeFindWindow() {
  findOpen.value = false
  findSnap.value = null      // 关闭即撤掉日志窗口里的命中边框
  findIndex.value = -1
  findBox.value = ''
}

function startFindDrag(e) {
  if (e.button !== 0) return
  e.preventDefault()
  const sx = e.clientX, sy = e.clientY
  const ox = findPos.x, oy = findPos.y
  const w = findEl.value ? findEl.value.offsetWidth : 640
  const h = findEl.value ? findEl.value.offsetHeight : 320
  const move = (ev) => {
    findPos.x = Math.max(0, Math.min(ox + ev.clientX - sx, window.innerWidth - w))
    findPos.y = Math.max(0, Math.min(oy + ev.clientY - sy, window.innerHeight - h))
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function onFindWinFocusChange() {
  findFocused.value = !!(findEl.value && findEl.value.contains(document.activeElement))
}

function onFindWinMouseDown() {
  if (findEl.value && !findEl.value.contains(document.activeElement)) findEl.value.focus()
}

function startFindResize(e, dir) {
  if (e.button !== 0) return
  e.preventDefault()
  const sx = e.clientX
  const startW = findSize.w
  const startX = findPos.x
  const minW = 360
  const move = (ev) => {
    const dx = ev.clientX - sx
    let w = startW, x = startX
    if (dir === 'w') { w = startW - dx; x = startX + dx }
    else w = startW + dx   // 'e'
    if (w < minW) { if (dir === 'w') x = startX + (startW - minW); w = minW }
    w = Math.min(w, window.innerWidth - 12)
    x = Math.max(0, Math.min(x, window.innerWidth - w))
    findSize.w = w; findPos.x = x
  }
  const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

function pushFindHistory() {
  const t = findDraft.target
  if (!t) return
  const list = findHistory.value.filter((x) => x !== t)
  list.unshift(t)
  findHistory.value = list.slice(0, 20)
}

function countFind() {
  pushFindHistory()
  const total = findMatches.value.length
  const lines = findHitsByLine.value.size
  findBox.value = total ? `共 ${total} 次匹配（分布在 ${lines} 行）` : '未找到匹配'
}

function stepFind(rawDir) {
  if (!findDraft.target) { findBox.value = '请输入查找目标'; return }
  const ms = findMatches.value
  const total = ms.length
  if (!total) { findIndex.value = -1; findBox.value = '未找到匹配'; return }
  pushFindHistory()
  const dir = findDraft.backward ? -rawDir : rawDir
  let i = findIndex.value < 0 ? (dir > 0 ? 0 : total - 1) : findIndex.value + dir
  if (i >= total) i = findDraft.wrap ? 0 : total - 1
  if (i < 0) i = findDraft.wrap ? total - 1 : 0
  // 命中行若被过滤或已滚出显示范围，沿查找方向继续找下一处「当前可见」的命中（最多绕一圈）
  const naive = i   // 常规落点：一圈都找不到可见命中时，保留它（序号不因扫描走位）
  let el = findLineEl(ms[i])
  if (!el && total > 1) {
    for (let n = 0; n < total; n++) {
      i += dir
      if (i >= total) { if (!findDraft.wrap) { i = total - 1; break } i = 0 }
      else if (i < 0) { if (!findDraft.wrap) { i = 0; break } i = total - 1 }
      el = findLineEl(ms[i])
      if (el) break
      if (i === naive) break
    }
    if (!el) i = naive
  }
  findIndex.value = i
  if (el) {
    autoscroll.value = false   // 定位到历史命中项时停止跟随，否则新日志会立刻把视图拉回底部
    suppressScrollCancel = true
    el.scrollIntoView({ block: 'center' })
    nextTick(() => { suppressScrollCancel = false })
    findBox.value = `第 ${i + 1}/${total} 次匹配`
  } else {
    // 命中行都不在当前视图中（被过滤 / 超出显示上限）：给出提示，避免「点了没反应」
    findBox.value = `第 ${i + 1}/${total} 次匹配（该行不在当前视图中：可能被过滤或超出显示上限）`
  }
}

function findLineEl(m) {
  if (!m || !logEl.value) return null
  return logEl.value.querySelector('[data-log-id="' + m.lineId + '"]')
}

function openFindFromCtx() {
  const sel = (ctxMenu.text || '').trim()
  ctxMenu.visible = false
  openFindWindow()
  if (sel && !sel.includes('\n') && sel.length <= 200) findDraft.target = sel
}

function onGlobalKey(e) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
    e.preventDefault()
    openFindWindow()
    return
  }
  if (e.key === 'Escape' && findOpen.value) closeFindWindow()
}

function onWheel(e) {
  if (e.ctrlKey) {
    e.preventDefault()
    api.send(e.deltaY < 0 ? 'window:zoomIn' : 'window:zoomOut')
    return
  }
  if (e.deltaY < 0 && autoscroll.value) {
    const t = e.target
    if (t && t.closest && t.closest('.logview')) autoscroll.value = false
  }
}

function insertNote(anchorId, ev) {
  const serial = activeLogSerial.value
  if (!serial || editingNoteId.value === anchorId) return
  if (editingNoteId.value) commitNoteById(editingNoteId.value)
  if (ev && ev.preventDefault) ev.preventDefault()   // 阻止点击默认焦点转移，保证下方输入框拿到焦点（一次点击即光标就位）
  const id = nextNoteId()
  if (!notesMap[serial]) notesMap[serial] = []
  notesMap[serial].push({ id, kind: 'note', text: '', anchorId, editing: true, savedLen: 0 })
  editingNoteId.value = id
  nextTick(() => {
    const el = logEl.value && logEl.value.querySelector('[data-note-input="' + id + '"]')
    if (el) { el.focus(); el.setSelectionRange(0, 0) }
  })
}

function insertTailNote(ev) {
  const dev = displayLogs.value
  const last = dev[dev.length - 1]
  insertNote(last ? last.id : '__tail__', ev)
  autoscroll.value = true   // 回车新增末尾行后开启跟随，使后续日志始终打印在该行之后并保持可见
}

function onNoteKey(e, n) {
  if (e.key === 'Escape') { e.preventDefault(); removeNote(n) }
}

function onNoteInput(e, n) {
  const el = e.target
  const lines = (n.text || '').split('\n').length
  if (el.rows !== lines) el.rows = lines
  noteFileAppend(n)
}

function noteFileAppend(n, immediate) {
  if (!autoLog.value || !activeLogSerial.value) return
  const serial = activeLogSerial.value
  const doWrite = () => {
    delete _noteSaveTimers[n.id]
    const t = n.text || ''
    const saved = n.savedLen || 0
    if (t.length <= saved) return
    const tail = t.slice(saved)
    const p = ensureAutoLogPath(serial)
    api.invoke('log:append', { path: p, text: tail }).catch(() => {})
    n.savedLen = t.length
  }
  if (immediate) {
    if (_noteSaveTimers[n.id]) { clearTimeout(_noteSaveTimers[n.id]); delete _noteSaveTimers[n.id] }
    doWrite()
  } else {
    if (_noteSaveTimers[n.id]) clearTimeout(_noteSaveTimers[n.id])
    _noteSaveTimers[n.id] = setTimeout(doWrite, 200)
  }
}

function commitNote(n) {
  if (!n.editing) return            // 已提交（如 blur 二次触发）则跳过，避免重复写盘
  // 空注释（点了光标但完全没输入）离开时直接丢弃，不在日志里留空行；含换行（用户主动回车出的空行）仍保留
  if ((n.text || '') === '') {
    removeNote(n)
    return
  }
  n.editing = false
  editingNoteId.value = null
  noteFileAppend(n, true)           // 把尚未落盘的末尾增量立即写入设备日志文件（仅写差值，避免重复）
  n.savedLen = 0
}

function commitNoteById(id) {
  const n = (notesMap[activeLogSerial.value] || []).find((x) => x.id === id)
  if (n) commitNote(n)
}

function removeNote(n) {
  n.editing = false
  if (_noteSaveTimers[n.id]) { clearTimeout(_noteSaveTimers[n.id]); delete _noteSaveTimers[n.id] }
  const arr = notesMap[activeLogSerial.value]
  if (arr) notesMap[activeLogSerial.value] = arr.filter((x) => x.id !== n.id)
  if (editingNoteId.value === n.id) editingNoteId.value = null
}

function editNote(n) {
  const serial = activeLogSerial.value
  if (!serial) return
  if (editingNoteId.value === n.id) return
  if (editingNoteId.value) commitNoteById(editingNoteId.value)
  n.editing = true
  n.savedLen = (n.text || '').length   // 已落盘部分不重复写，仅后续新增走增量
  editingNoteId.value = n.id
  nextTick(() => {
    const el = logEl.value && logEl.value.querySelector('[data-note-input="' + n.id + '"]')
    if (el) { el.focus(); const v = el.value || ''; el.setSelectionRange(v.length, v.length) }
  })
}

async function exportLogs() {
  const arr = mergedView.value
  if (!arr.length) return
  // 由模型直接构造：设备日志按格式，注释按原文（空注释即空行），顺序与屏幕一致
  const content = arr.map((e) => e.kind === 'note' ? (e.text || '') : formatLogLine(e)).join('\n')
  if (!content.trim()) return
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const ts = '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  const defaultPath = (cfg.value.outDir || '') + '/logcat_' + deviceLabel(activeLogSerial.value || 'unknown') + '_' + ts + '.log'
  const path = await api.invoke('file:saveText', {
    content, defaultPath, filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
  })
  if (path) lastMsg.value = '已导出：' + path
}

let autoLogTimer = null
let suppressScrollCancel = false
export function useLogcat() {
watch(() => {
  const arr = logsMap[activeLogSerial.value]
  return arr && arr.length ? arr[arr.length - 1].id : 0
}, () => {
  // 注释行现在都锚定在日志底部（回车新增），编辑期间也继续跟随，使新日志始终打印在注释行之后且可见；
  // 仅在自动滚动关闭时不滚底
  if (autoscroll.value && logEl.value) {
    suppressScrollCancel = true
    nextTick(() => {
      if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
      suppressScrollCancel = false
    })
  }
})
watch(activeLogSerial, (now, old) => {
  if (old && logEl.value) scrollPosMap[old] = logEl.value.scrollTop   // 切走前保存旧设备位置
  nextTick(() => {
    if (!logEl.value || !now) return
    if (!autoscroll.value) {
      const pos = scrollPosMap[now]
      if (typeof pos === 'number') logEl.value.scrollTop = pos
    }
  })
})
watch([textFilter, regexFilter], () => {
  if (qfOpen.value) syncCheckFromRegex()
})
watch(activeLogSerial, () => { if (findOpen.value) refreshFindScope() })
watch(() => [findDraft.target, findDraft.mode, findDraft.matchCase, findDraft.wholeWord, findDraft.dotAll].join('\u0000'), () => {
  findIndex.value = -1
  findBox.value = ''
})

  return { anyAutoLogActive, applyAutoLog, browseAppLogDir, cancelFmt, clearKeywordFilter, clearLogs, clearTagFilter, closeCtxMenu, closeFindWindow, closeQuickFilter, collectTagStats, commitNote, commitNoteById, commitQuickFilter, confirmFmt, copySelection, countFind, deviceLabel, editNote, ensureAutoLogPath, ensureLogFilter, escapeRegExp, escapeRegexTag, exportLogs, findLineEl, findSegsFor, flushAutoLog, fmtLineOf, focusFindInput, formatLogLine, insertNote, insertTailNote, invertQf, loadProcToPkg, noteFileAppend, onAppLogChange, onAutoLogChange, onData, onDataAutoLog, onFindWinFocusChange, onFindWinMouseDown, onGlobalKey, onLogContextMenu, onLogKey, onLogMouseDown, onLogScrollSave, onNoteInput, onNoteKey, onWheel, openFindFromCtx, openFindWindow, openFmt, openQuickFilter, pidMapFor, pushFindHistory, refreshFindScope, refreshProcs, removeNote, resetFindPosOnce, resetQf, sanitizeSerial, scrollToBottom, scrollToTop, selectAllLogs, sortPkgs, startAutoLogFlush, startFindDrag, startFindResize, startLogcat, stepFind, stopAutoLogFlush, stopLogcat, syncCheckFromRegex, toggleAllQf, toggleLatest, toggleLogcat, unescapeRegexTag }
}
export { anyAutoLogActive, applyAutoLog, browseAppLogDir, cancelFmt, clearKeywordFilter, clearLogs, clearTagFilter, closeCtxMenu, closeFindWindow, closeQuickFilter, collectTagStats, commitNote, commitNoteById, commitQuickFilter, confirmFmt, copySelection, countFind, deviceLabel, editNote, ensureAutoLogPath, ensureLogFilter, escapeRegExp, escapeRegexTag, exportLogs, findLineEl, findSegsFor, flushAutoLog, fmtLineOf, focusFindInput, formatLogLine, insertNote, insertTailNote, invertQf, loadProcToPkg, noteFileAppend, onAppLogChange, onAutoLogChange, onData, onDataAutoLog, onFindWinFocusChange, onFindWinMouseDown, onGlobalKey, onLogContextMenu, onLogKey, onLogMouseDown, onLogScrollSave, onNoteInput, onNoteKey, onWheel, openFindFromCtx, openFindWindow, openFmt, openQuickFilter, pidMapFor, pushFindHistory, refreshFindScope, refreshProcs, removeNote, resetFindPosOnce, resetQf, sanitizeSerial, scrollToBottom, scrollToTop, selectAllLogs, sortPkgs, startAutoLogFlush, startFindDrag, startFindResize, startLogcat, stepFind, stopAutoLogFlush, stopLogcat, syncCheckFromRegex, toggleAllQf, toggleLatest, toggleLogcat, unescapeRegexTag }