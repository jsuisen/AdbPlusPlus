// 由 split_app2.cjs 自动拆分生成（config）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {DEFAULT_LOG_BG_COLORS, DEFAULT_LOG_BG_ON, DEFAULT_LOG_COLORS, DEFAULT_LOG_COLOR_BOLD, DEFAULT_MAX_RENDER, activeLogSerial, api, appLogEnabled, appPkg, autoLog, autoLogMeta, cfg, currentFontLabel, fontNames, fontPickerOpen, fontQuery, keyButtons, lastMsg, levelFilter, logBgColors, logBgOn, logColorBold, logColorRules, logColors, logFont, quickCommands, selectedSerial, settingsTab, swipeButtons, tagFilter, tapButtons, textButtons, textFilter} from './state'
import { toast } from './useUi'

function setTab(name) { settingsTab.value = name }

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
}

async function loadSystemFonts() {
  try {
    const list = await api.invoke('system:getFonts')
    if (Array.isArray(list) && list.length) fontNames.value = list
  } catch { /* 拉取失败保留兜底字体名 */ }
  syncFontQuery()
}

function saveCfg() {
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
}

function applyConfig(c, { applyDeviceState = true } = {}) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return
  cfg.value = { ...cfg.value, ...c }
  quickCommands.value = c.quickCommands || []
  keyButtons.value = c.keyButtons || []
  textButtons.value = c.textButtons || []
  tapButtons.value = c.tapButtons || []
  swipeButtons.value = c.swipeButtons || []
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
    filters: [{ name: 'JSON 配置', extensions: ['json'] }]
  })
  if (p) lastMsg.value = '已导出设置：' + p
}

async function importSettings() {
  const p = await api.invoke('file:openFile', { filters: [{ name: 'JSON 配置', extensions: ['json'] }] })
  if (!p) return
  let raw
  try {
    raw = await api.invoke('file:readText', { path: p })
  } catch (e) { lastMsg.value = '读取文件失败：' + e.message; return }
  let data
  try {
    data = JSON.parse(raw)
  } catch (e) { lastMsg.value = '文件不是合法 JSON：' + e.message; return }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    lastMsg.value = '配置文件格式不正确（应为 JSON 对象）'; return
  }
  // 至少含一个已知配置键，避免误导入无关 JSON 把当前配置清空
  const known = ['quickCommands', 'levelFilter', 'tagFilter', 'textFilter', 'lastSerial', 'outDir', 'targetPkg', 'configPath', 'autoLog', 'appLogEnabled', 'appLogDir', 'logColors', 'logColorBold', 'logBgColors', 'logBgOn', 'logColorRules', 'logFont', 'keyButtons', 'textButtons', 'tapButtons', 'swipeButtons', 'captureArgs', 'captureDeviceDir', 'captureLocalDir', 'captureAsRoot', 'screenshotDir', 'screenshotInterval', 'maxRender', 'closeOnOuterClick', 'cursorMoveNoScroll']
  if (!known.some(k => k in data)) {
    lastMsg.value = '该文件不含任何 AdbPlusPlus 配置项，已取消导入'; return
  }
  // 配置存放路径（configPath）与当前设备选择（lastSerial/targetPkg）属于机器/运行态，导入时不覆盖，避免改写到本机配置文件位置或打断当前设备
  const safe = { ...data }
  delete safe.configPath
  delete safe.lastSerial
  delete safe.targetPkg
  applyConfig(safe, { applyDeviceState: false })
  saveCfg()
  lastMsg.value = '已导入设置：' + p
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
    filters: [{ name: 'JSON 配置', extensions: ['json'] }]
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

  return { applyConfig, browseCaptureLocalDir, browseConfigPath, browseOutDir, browseScreenshotDir, exportSettings, importSettings, loadSystemFonts, maskClose, normalizeHex, onBgInput, onDocMouseDown, onFontChange, onHexInput, onLogColorChange, onMaxRenderChange, openFontPicker, pickFont, resetLogColors, saveCfg, setTab, syncFontQuery }
}
export { applyConfig, browseCaptureLocalDir, browseConfigPath, browseOutDir, browseScreenshotDir, exportSettings, importSettings, loadSystemFonts, maskClose, normalizeHex, onBgInput, onDocMouseDown, onFontChange, onHexInput, onLogColorChange, onMaxRenderChange, openFontPicker, pickFont, resetLogColors, saveCfg, setTab, syncFontQuery }