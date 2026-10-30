// 由 split_app2.cjs 自动拆分生成（colorrules）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {activeLogSerial, colorDraft, colorDraftErr, colorModalEditId, colorModalOpen, colorModalScope, colorSessionEnabled, colorSessionMap, colorWinOpen, logBgColors, logBgOn, logColorBold, logColorRules, logColors} from './state'
import { normalizeHex, saveCfg } from './useConfig'
import { toast } from './useUi'

function openAddColorRule(scope) {
  colorModalScope.value = scope
  colorModalEditId.value = null
  colorDraft.keyword = ''
  colorDraft.byTag = false
  colorDraft.byMsg = false
  colorDraft.color = '#FF0000'
  colorDraft.bold = false
  colorDraft.enabled = true
  colorDraft.bgColor = '#FFFFFF'
  colorDraft.bgOn = true
  colorDraftErr.value = ''
  colorModalOpen.value = true
}

function openEditColorRule(item) {
  colorModalScope.value = item.scope
  const list = item.scope === 'session' ? (colorSessionMap[activeLogSerial.value] || []) : logColorRules.value
  colorModalEditId.value = list.indexOf(item.rule)
  colorDraft.keyword = item.rule.keyword
  colorDraft.byTag = item.rule.byTag
  colorDraft.byMsg = item.rule.byMsg
  colorDraft.color = item.rule.color
  colorDraft.bold = item.rule.bold
  colorDraft.enabled = item.rule.enabled !== false
  colorDraft.bgColor = item.rule.bgColor || '#FFFFFF'
  colorDraft.bgOn = item.rule.bgOn !== false
  colorDraftErr.value = ''
  colorModalOpen.value = true
}

function onDraftHexInput(val) {
  const h = normalizeHex(val)
  if (h) colorDraft.color = h
}

function onDraftBgInput(val) {
  const h = normalizeHex(val)
  if (h) colorDraft.bgColor = h
}

function onRuleHexInput(item, val) {
  const h = normalizeHex(val)
  if (h) { item.rule.color = h; if (item.scope === 'global') saveCfg() }
}

function onRuleBgInput(item, val) {
  const h = normalizeHex(val)
  if (h) { item.rule.bgColor = h; if (item.scope === 'global') saveCfg() }
}

function onRuleChange(item) { if (item.scope === 'global') saveCfg() }

function deleteColorRule() {
  if (colorModalEditId.value == null) return
  if (colorModalScope.value === 'session') {
    const list = colorSessionMap[activeLogSerial.value] || []
    if (list[colorModalEditId.value]) list.splice(colorModalEditId.value, 1)
  } else {
    if (logColorRules.value[colorModalEditId.value]) logColorRules.value.splice(colorModalEditId.value, 1)
    saveCfg()
  }
  colorModalOpen.value = false
}

function deleteColorRuleItem(item) {
  const list = item.scope === 'session' ? (colorSessionMap[activeLogSerial.value] || []) : logColorRules.value
  const i = list.indexOf(item.rule)
  if (i >= 0) list.splice(i, 1)
  if (item.scope === 'global') saveCfg()
}

function saveColorRule() {
  const kw = colorDraft.keyword.trim()
  if (!kw) { colorDraftErr.value = '关键字不能为空'; return }
  if (!colorDraft.byTag && !colorDraft.byMsg) { colorDraftErr.value = '请至少勾选「匹配 Tag」或「匹配日志内容」之一'; return }
  const rec = { keyword: kw, byTag: !!colorDraft.byTag, byMsg: !!colorDraft.byMsg, color: normalizeHex(colorDraft.color) || '#FF0000', bold: !!colorDraft.bold, enabled: colorDraft.enabled !== false, bgColor: normalizeHex(colorDraft.bgColor) || '#FFFFFF', bgOn: !!colorDraft.bgOn }
  if (colorModalScope.value === 'session') {
    const s = activeLogSerial.value
    if (!s) { colorDraftErr.value = '请先选择设备'; return }
    const list = colorSessionMap[s] || (colorSessionMap[s] = [])
    if (colorModalEditId.value != null && list[colorModalEditId.value]) Object.assign(list[colorModalEditId.value], rec)
    else list.push(rec)
  } else {
    if (colorModalEditId.value != null && logColorRules.value[colorModalEditId.value]) Object.assign(logColorRules.value[colorModalEditId.value], rec)
    else logColorRules.value.push(rec)
    saveCfg()
  }
  colorModalOpen.value = false
}

function openColorWin() {
  if (!activeLogSerial.value) { toast('请先选择设备并开始采集日志'); return }
  colorWinOpen.value = true
}

function effectiveGlobalEnabled(serial, keyword, fallback) {
  const m = colorSessionEnabled[serial]
  if (m && Object.prototype.hasOwnProperty.call(m, keyword)) return m[keyword]
  return fallback
}

function ruleEnabled(item) {
  if (item.scope === 'global') return effectiveGlobalEnabled(activeLogSerial.value, item.rule.keyword, item.rule.enabled !== false)
  return item.rule.enabled !== false
}

function onToggleEnabled(item, val) {
  if (item.scope === 'session') { item.rule.enabled = !!val; return }
  const s = activeLogSerial.value
  if (!s) return
  if (!colorSessionEnabled[s]) colorSessionEnabled[s] = {}
  colorSessionEnabled[s][item.rule.keyword] = !!val
}

function matchColorRule(e, list, serial, isGlobal) {
  for (const r of list) {
    const on = isGlobal ? effectiveGlobalEnabled(serial, r.keyword, r.enabled !== false) : (r.enabled !== false)
    if (!on) continue        // 未勾选「是否生效」的规则不参与上色（全局规则取会话内覆盖值）
    if (!r.byTag && !r.byMsg) continue
    if (r.byTag && (e.tag || '').toLowerCase().includes(r.keyword.toLowerCase())) return r
    if (r.byMsg && (e.msg || '').toLowerCase().includes(r.keyword.toLowerCase())) return r
  }
  return null
}

function logLineStyle(e) {
  const serial = activeLogSerial.value
  const session = colorSessionMap[serial] || []
  let rule = matchColorRule(e, session, serial, false)
  if (!rule) rule = matchColorRule(e, logColorRules.value, serial, true)
  if (rule) {
    // 「启动」(bgOn) 关闭：不应用该规则的任何着色，回退到按级别颜色/加粗/背景；开启：同时应用文字色与背景色（加粗仍由 bold 决定）
    if (!rule.bgOn) return { color: logColors[e.level], fontWeight: logColorBold[e.level] ? '700' : '' }
    const s = { color: rule.color, fontWeight: rule.bold ? '700' : '' }
    if (rule.bgColor) s.backgroundColor = rule.bgColor
    return s
  }
  const s = { color: logColors[e.level], fontWeight: logColorBold[e.level] ? '700' : '' }
  if (logBgOn[e.level]) s.backgroundColor = logBgColors[e.level]
  return s
}

export function useColorrules() {

  return { deleteColorRule, deleteColorRuleItem, effectiveGlobalEnabled, logLineStyle, matchColorRule, onDraftBgInput, onDraftHexInput, onRuleBgInput, onRuleChange, onRuleHexInput, onToggleEnabled, openAddColorRule, openColorWin, openEditColorRule, ruleEnabled, saveColorRule }
}
export { deleteColorRule, deleteColorRuleItem, effectiveGlobalEnabled, logLineStyle, matchColorRule, onDraftBgInput, onDraftHexInput, onRuleBgInput, onRuleChange, onRuleHexInput, onToggleEnabled, openAddColorRule, openColorWin, openEditColorRule, ruleEnabled, saveColorRule }