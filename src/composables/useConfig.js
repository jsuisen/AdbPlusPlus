// 由 split_app2.cjs 自动拆分生成（config）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t } from '@/i18n'
import {DEFAULT_FILTER_HISTORY_MAX, DEFAULT_LOG_BG_COLORS, DEFAULT_LOG_BG_ON, DEFAULT_LOG_COLORS, DEFAULT_LOG_COLOR_BOLD, DEFAULT_MAX_RENDER, NO_GROUP, activeLogSerial, api, appLogEnabled, appPkg, autoLog, autoLogMeta, cfg, currentFontLabel, deviceAlias, filterHistoryOpen, fontNames, fontPickerOpen, fontQuery, keyButtons, levelFilter, logBgColors, logBgOn, logColorBold, logColorRules, logColors, logFont, quickCommands, selectedSerial, settingsTab, swipeButtons, tagFilter, tapButtons, textButtons, textFilter, showResult} from './state'
import { toast } from './useUi'

// 旧配置里的中文默认分组名。单独常量，避免门禁把迁移用的必要比较当成中文哨兵。
const LEGACY_DEFAULT_GROUP = '默认'

function setTab(name) { settingsTab.value = name }

// ---------- 过滤历史（Tag / 关键字，各自独立列表；随 cfg 一起持久化） ----------
// 元素形态 { text, locked }；数组顺序 = 最近操作在前。锁定项：不被清空、不被新记录挤出上限裁剪。
const FILTER_HISTORY_KINDS = ['tag', 'text']

function normalizeFilterHistoryMax(v) {
  let n = Number(v)
  if (!Number.isFinite(n) || n < 1) n = DEFAULT_FILTER_HISTORY_MAX
  n = Math.floor(n)
  return n > 200 ? 200 : n
}

// 兼容旧配置 / 导入文件：忽略非对象、非数组、空文本、重复项，锁定标志强制布尔化。
function normalizeFilterHistory(fh) {
  const out = { tag: [], text: [] }
  const src = (fh && typeof fh === 'object' && !Array.isArray(fh)) ? fh : {}
  for (const kind of FILTER_HISTORY_KINDS) {
    const arr = Array.isArray(src[kind]) ? src[kind] : []
    const seen = new Set()
    for (const it of arr) {
      const text = typeof it === 'string' ? it.trim() : String((it && it.text) || '').trim()
      if (!text || seen.has(text)) continue
      seen.add(text)
      out[kind].push({ text, locked: !!(it && typeof it === 'object' && it.locked) })
    }
  }
  return out
}

// 取（必要时建）对应类型的数组引用；所有增删改都就地改数组，保持 computed 视图响应。
function fhList(kind) {
  if (!cfg.value.filterHistory || typeof cfg.value.filterHistory !== 'object' || Array.isArray(cfg.value.filterHistory)) {
    cfg.value.filterHistory = { tag: [], text: [] }
  }
  const fh = cfg.value.filterHistory
  if (!Array.isArray(fh[kind])) fh[kind] = []
  return fh[kind]
}

// 裁剪到上限：从最旧一端开始删「未锁定」项；若全锁定则视为软上限，一条都不删。
function trimFilterHistory(kind) {
  const list = fhList(kind)
  const max = cfg.value.filterHistoryMax = normalizeFilterHistoryMax(cfg.value.filterHistoryMax)
  while (list.length > max) {
    let idx = -1
    for (let i = list.length - 1; i >= 0; i--) { if (!list[i].locked) { idx = i; break } }
    if (idx < 0) break
    list.splice(idx, 1)
  }
}

// 提交一条过滤文本到历史：去重置顶（保留原锁定标志），再按上限裁剪并落盘。
function addFilterHistory(kind, raw) {
  if (!FILTER_HISTORY_KINDS.includes(kind)) return false
  const text = String(raw == null ? '' : raw).trim()
  if (!text) return false
  const list = fhList(kind)
  const i = list.findIndex((h) => h.text === text)
  if (i >= 0) {
    const [hit] = list.splice(i, 1)
    list.unshift(hit)
  } else {
    list.unshift({ text, locked: false })
  }
  trimFilterHistory(kind)
  saveCfg()
  return true
}

// 清空：仅删未锁定项；锁定项始终保留。
function clearFilterHistory(kind) {
  const list = fhList(kind)
  cfg.value.filterHistory[kind] = list.filter((h) => h.locked)
  saveCfg()
}

function removeFilterHistory(kind, text) {
  const list = fhList(kind)
  const i = list.findIndex((h) => h.text === text)
  if (i < 0) return
  list.splice(i, 1)
  saveCfg()
}

function toggleFilterHistoryLock(kind, text) {
  const hit = fhList(kind).find((h) => h.text === text)
  if (!hit) return
  hit.locked = !hit.locked
  saveCfg()
}

// 上限改小立即裁剪；改大不动现有记录。
function onFilterHistoryMaxChange() {
  cfg.value.filterHistoryMax = normalizeFilterHistoryMax(cfg.value.filterHistoryMax)
  trimFilterHistory('tag')
  trimFilterHistory('text')
  saveCfg()
}

function maskClose(action) { if (cfg.value.closeOnOuterClick) action() }

function onLogColorChange() { saveCfg() }

function resetLogColors() {
  Object.assign(logColors, DEFAULT_LOG_COLORS)
  Object.assign(logColorBold, DEFAULT_LOG_COLOR_BOLD)
  Object.assign(logBgColors, DEFAULT_LOG_BG_COLORS)
  Object.assign(logBgOn, DEFAULT_LOG_BG_ON)
  saveCfg()
}

function normalizeHex(val) {
  val = (val || '').trim()
  let m = /^#?([0-9a-fA-F]{3})$/.exec(val)
  if (m) return '#' + m[1].split('').map(c => c + c).join('').toLowerCase()
  m = /^#?([0-9a-fA-F]{6})$/.exec(val)
  if (m) return '#' + m[1].toLowerCase()
  return null
}

function onHexInput(key, val) {
  const h = normalizeHex(val)
  if (h) { logColors[key] = h; saveCfg() }
}

function onBgInput(key, val) {
  const h = normalizeHex(val)
  if (h) { logBgColors[key] = h; saveCfg() }
}

function onFontChange() { saveCfg() }

function onMaxRenderChange() {
  let v = Number(cfg.value.maxRender)
  if (!Number.isFinite(v) || v < 1000) v = DEFAULT_MAX_RENDER
  if (v > 200000) v = 200000
  cfg.value.maxRender = v
  saveCfg()
}

function openFontPicker() { fontPickerOpen.value = true }

function pickFont(opt) {
  logFont.family = opt.value
  fontQuery.value = opt.label
  fontPickerOpen.value = false
  saveCfg()
}

function syncFontQuery() { fontQuery.value = currentFontLabel.value }

function onDocMouseDown(e) {
  if (!e.target.closest || !e.target.closest('.font-picker')) fontPickerOpen.value = false
  if (!e.target.closest || !e.target.closest('.filter-history')) filterHistoryOpen.value = ''
}

async function loadSystemFonts() {
  try {
    const list = await api.invoke('system:getFonts')
    if (Array.isArray(list) && list.length) fontNames.value = list
  } catch { /* 拉取失败保留兜底字体名 */ }
  syncFontQuery()
}

let saveCfgTimer = null
function doSaveCfg() {
  saveCfgTimer = null
  cfg.value.lastSerial = selectedSerial.value
  cfg.value.targetPkg = appPkg.value
  cfg.value.quickCommands = quickCommands.value
  cfg.value.keyButtons = keyButtons.value
  cfg.value.textButtons = textButtons.value
  cfg.value.tapButtons = tapButtons.value
  cfg.value.swipeButtons = swipeButtons.value
  cfg.value.logColors = { ...logColors }
  cfg.value.logColorBold = { ...logColorBold }
  cfg.value.logBgColors = { ...logBgColors }
  cfg.value.logBgOn = { ...logBgOn }
  cfg.value.logColorRules = logColorRules.value.map(r => ({ ...r }))
  cfg.value.logFont = { ...logFont }
  cfg.value.autoLog = autoLog.value
  cfg.value.appLogEnabled = appLogEnabled.value
  // cfg.value 是响应式代理，IPC 无法克隆 Proxy；转成普通对象快照再传，避免 “An object could not be cloned.”
  api.invoke('config:save', JSON.parse(JSON.stringify(cfg.value)))
    .catch((e) => { console.error('[config] 配置保存失败:', e) })
}
// 高频调用（滚轮调字体、快捷命令输入等）200ms 去抖；显式传 true 时立即落盘。
// 注意模板里写 @change="saveCfg" 会把 Event 当第一实参，所以只认 === true。
function saveCfg(immediate = false) {
  if (immediate === true) {
    if (saveCfgTimer) { clearTimeout(saveCfgTimer); saveCfgTimer = null }
    doSaveCfg()
    return
  }
  if (saveCfgTimer) return
  saveCfgTimer = setTimeout(doSaveCfg, 200)
}

function applyConfig(c, { applyDeviceState = true } = {}) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return
  cfg.value = { ...cfg.value, ...c }
  // 过滤历史形状归一化：旧配置缺字段 → 空列表；异常形状 → 回落空列表，避免下拉渲染时抛错。
  cfg.value.filterHistory = normalizeFilterHistory(c.filterHistory)
  cfg.value.filterHistoryMax = normalizeFilterHistoryMax(c.filterHistoryMax)
  // 连接历史形状归一化：旧配置缺字段 → 空数组；异常形状 → 空数组，避免下拉渲染时抛错。
  // 同时按历史里的别名重建 deviceAlias：别名此前只在内存，现随配置跨重启恢复。
  const hist = Array.isArray(c.connectHistory) ? c.connectHistory : []
  cfg.value.connectHistory = hist.filter((h) => h && typeof h === 'object' && h.ip)
    .map((h) => ({ ip: String(h.ip), port: String(h.port || '5555'), alias: String(h.alias || '') }))
  if (Array.isArray(cfg.value.connectHistory)) {
    for (const h of cfg.value.connectHistory) {
      if (h.alias) deviceAlias[`${h.ip}:${h.port}`] = h.alias
    }
  }
  quickCommands.value = c.quickCommands || []
  keyButtons.value = c.keyButtons || []
  textButtons.value = c.textButtons || []
  tapButtons.value = c.tapButtons || []
  swipeButtons.value = c.swipeButtons || []
  // i18n 迁移：旧版本把「默认」当分组名写进配置，切语言后会同时出现「默认 / Default」两个幽灵组。
  // 仅精确匹配该字面值，其它用户分组一律不动；显示时由 NO_GROUP 回退到 t('common.defaultGroup')。
  for (const list of [quickCommands.value, keyButtons.value, textButtons.value, tapButtons.value, swipeButtons.value]) {
    for (const item of list) if (item && item.group === LEGACY_DEFAULT_GROUP) item.group = NO_GROUP
  }
  if (c.logColors) Object.assign(logColors, c.logColors)
  if (c.logColorBold) Object.assign(logColorBold, c.logColorBold)
  if (c.logBgColors) Object.assign(logBgColors, c.logBgColors)
  if (c.logBgOn) Object.assign(logBgOn, c.logBgOn)
  if (Array.isArray(c.logColorRules)) {
    logColorRules.value.length = 0
    for (const r of c.logColorRules) {
      // 设置列表不再暴露「是否生效」，开关统一为 bgOn；兼容旧配置：原 enabled=false 视为「启用」关闭
      const on = r.enabled === false ? false : true
      logColorRules.value.push({
        keyword: r.keyword || '',
        byTag: !!r.byTag,
        byMsg: !!r.byMsg,
        color: r.color || '#FF0000',
        bold: !!r.bold,
        enabled: true,
        bgColor: r.bgColor || '#FFFFFF',
        bgOn: r.bgOn === false ? false : on
      })
    }
  }
  if (c.logFont) Object.assign(logFont, c.logFont)
  autoLog.value = !!c.autoLog
  appLogEnabled.value = !!c.appLogEnabled
  syncFontQuery()
  if (applyDeviceState) {
    selectedSerial.value = c.lastSerial || ''
    activeLogSerial.value = selectedSerial.value
    appPkg.value = c.targetPkg || ''
  }
}

async function exportSettings() {
  // cfg.value 是响应式代理，先转普通对象快照再序列化，避免不可克隆字段
  cfg.value.logColorBold = { ...logColorBold }
  cfg.value.logBgColors = { ...logBgColors }
  cfg.value.logBgOn = { ...logBgOn }
  cfg.value.logColorRules = logColorRules.value.map(r => ({ ...r }))
  const snapshot = JSON.parse(JSON.stringify(cfg.value))
  const p = await api.invoke('file:saveText', {
    content: JSON.stringify(snapshot, null, 2),
    defaultPath: 'adbplusplus-settings.json',
    filters: [{ name: t('common.jsonConfig'), extensions: ['json'] }]
  })
  if (p) showResult(t('settings.exportSettings'), t('toast.settingsExported') + p, true)
}

async function importSettings() {
  const p = await api.invoke('file:openFile', { filters: [{ name: t('common.jsonConfig'), extensions: ['json'] }] })
  if (!p) return
  let raw
  try {
    raw = await api.invoke('file:readText', { path: p })
  } catch (e) { showResult(t('settings.importSettings'), t('toast.readFileFailed') + e.message + t('common.fileLine') + p, false); return }
  let data
  try {
    data = JSON.parse(raw)
  } catch (e) { showResult(t('settings.importSettings'), t('toast.invalidJson') + e.message + t('common.fileLine') + p, false); return }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    showResult(t('settings.importSettings'), t('toast.invalidConfig') + t('common.fileLine') + p, false); return
  }
  // 至少含一个已知配置键，避免误导入无关 JSON 把当前配置清空
  const known = ['quickCommands', 'levelFilter', 'tagFilter', 'textFilter', 'lastSerial', 'outDir', 'targetPkg', 'configPath', 'autoLog', 'appLogEnabled', 'appLogDir', 'logColors', 'logColorBold', 'logBgColors', 'logBgOn', 'logColorRules', 'logFont', 'keyButtons', 'textButtons', 'tapButtons', 'swipeButtons', 'captureArgs', 'captureDeviceDir', 'captureLocalDir', 'captureAsRoot', 'screenshotDir', 'screenshotInterval', 'maxRender', 'filterHistoryMax', 'filterHistory', 'lastConnectIp', 'lastConnectPort', 'connectHistory', 'closeOnOuterClick', 'cursorMoveNoScroll']
  if (!known.some(k => k in data)) {
    showResult(t('settings.importSettings'), t('toast.noConfigItems') + t('common.fileLine') + p, false); return
  }
  // 只保留已知键：旧实现用 {...data} 浅合并，任意 JSON 都能往 cfg 里塞未知键，
  // 再经 saveCfg 落盘、被 netcap 读取，形成「外部配置 -> 设备端 root 命令」的注入链。
  // 配置存放路径（configPath）与当前设备选择（lastSerial/targetPkg）属机器/运行态，导入时不覆盖。
  // lang / keycodeLangMode 属本机语言偏好，同样不进 known 白名单 —— 导入他人配置不应改掉我的界面语言。
  const safe = {}
  for (const k of known) {
    if (k === 'configPath' || k === 'lastSerial' || k === 'targetPkg') continue
    if (Object.prototype.hasOwnProperty.call(data, k)) safe[k] = data[k]
  }
  applyConfig(safe, { applyDeviceState: false })
  saveCfg()
  showResult(t('settings.importSettings'), t('toast.settingsImported') + p, true)
}

async function browseOutDir() {
  const dir = await api.invoke('file:pickDir', { defaultPath: cfg.value.outDir || undefined })
  if (!dir) return
  cfg.value.outDir = dir
  saveCfg()
  for (const k in autoLogMeta) delete autoLogMeta[k]
}

async function browseConfigPath() {
  const p = await api.invoke('file:pickSave', {
    defaultPath: cfg.value.configPath || (cfg.value.outDir ? cfg.value.outDir + '/adbtool-config.json' : 'adbtool-config.json'),
    filters: [{ name: t('common.jsonConfig'), extensions: ['json'] }]
  })
  if (!p) return
  cfg.value.configPath = p
  saveCfg()
}

async function browseCaptureLocalDir() {
  const dir = await api.invoke('file:pickDir', { defaultPath: cfg.value.captureLocalDir || cfg.value.outDir || undefined })
  if (!dir) return
  cfg.value.captureLocalDir = dir
  saveCfg()
}

async function browseScreenshotDir() {
  const dir = await api.invoke('file:pickDir', { defaultPath: cfg.value.screenshotDir || cfg.value.outDir || undefined })
  if (!dir) return
  cfg.value.screenshotDir = dir
  saveCfg()
}

export function useConfig() {

  return { addFilterHistory, applyConfig, browseCaptureLocalDir, browseConfigPath, browseOutDir, browseScreenshotDir, clearFilterHistory, exportSettings, importSettings, loadSystemFonts, maskClose, normalizeHex, onBgInput, onDocMouseDown, onFilterHistoryMaxChange, onFontChange, onHexInput, onLogColorChange, onMaxRenderChange, openFontPicker, pickFont, removeFilterHistory, resetLogColors, saveCfg, setTab, syncFontQuery, toggleFilterHistoryLock }
}
export { addFilterHistory, applyConfig, browseCaptureLocalDir, browseConfigPath, browseOutDir, browseScreenshotDir, clearFilterHistory, exportSettings, importSettings, loadSystemFonts, maskClose, normalizeHex, onBgInput, onDocMouseDown, onFilterHistoryMaxChange, onFontChange, onHexInput, onLogColorChange, onMaxRenderChange, openFontPicker, pickFont, removeFilterHistory, resetLogColors, saveCfg, setTab, syncFontQuery, toggleFilterHistoryLock }