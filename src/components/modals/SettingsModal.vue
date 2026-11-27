<script setup>
// 设置面板：通用 / 窗口属性 / 程序日志路径 / 日志字体 / 日志级别颜色 / 日志内容颜色 / 日志自动保存 / 历史过滤设置 / 抓包设置 / 截图设置
import { reactive, computed } from 'vue'
import { flatten } from '@shared/i18n/translate.js'
import zhCN from '@shared/i18n/locales/zh-CN.js'
import keycodeZh from '@shared/i18n/locales/keycode.zh-CN.js'
import { t, locale, locales, warnings, missingCount, scanDir, setKeycodeMode } from '@/i18n'
import { loadI18n } from '@/composables/useApp'
import { applyTheme } from '@/composables/useTheme'
import { applyBackground, browseBackgroundImage, clearBackgroundImage, resetBackground, setZoneAlpha, setZoneColor } from '@/composables/useBackground'
import AppSelect from '../AppSelect.vue'
import * as State from '@/composables/state'
import {
  maskClose, setTab, resetLogColors, onLogColorChange, onHexInput, onBgInput,
  browseOutDir, onMaxRenderChange, browseConfigPath, exportSettings, importSettings,
  onFontChange, openFontPicker, pickFont, saveCfg, syncLogColorsForTheme,
  browseCaptureLocalDir, browseOfflineLogLocalDir, browseScreenshotDir,
  addFilterHistory, clearFilterHistory, removeFilterHistory, toggleFilterHistoryLock, onFilterHistoryMaxChange
} from '@/composables/useConfig'
import { onAutoLogChange, onAppLogChange, browseAppLogDir } from '@/composables/useLogcat'
import { onAutoReconnectChange } from '@/composables/useDevices'
import { openAddColorRule } from '@/composables/useColorrules'
import ColorRulesTable from '../ColorRulesTable.vue'

const {
  settingsOpen, settingsTab, levelList, logColors, logColorBold, logBgColors, logBgOn,
  autoLog, cfg, appLogEnabled, globalColorRulesView,
  logFont, fontQuery, fontPickerOpen, filteredFonts, logFontStyle,
  tagHistory, textHistory, api, showResult
} = State

// 手动新增历史：两个输入框各自暂存，添加成功后清空。
const fhDraft = reactive({ tag: '', text: '' })

// 背景分区定义：模板只循环这份清单，两个区的开关/颜色/透明度互不影响。
const bgZoneDefs = [
  { key: 'chrome', labelKey: 'settings.bgZoneChrome', fallback: '#FFFFFF' },
  { key: 'log', labelKey: 'settings.bgZoneLog', fallback: '#FFFFFF' }
]
function onBgToggle() { applyBackground(); saveCfg() }
async function onBgPick() { await browseBackgroundImage(); saveCfg() }
function onBgClear() { clearBackgroundImage(); saveCfg() }
function onBgReset() { resetBackground(); saveCfg() }
function onBgColor(key, val) { setZoneColor(key, val); saveCfg() }
function onBgAlpha(key, val) { setZoneAlpha(key, val); saveCfg() }
// 注意：computed 必须在此 `.value` 取成普通数组。若把 ref 直接塞进普通对象，
// 模板里的 sect.list 不会被自动解包，v-for 拿到的是 ref 对象而非数组。
const fhSections = computed(() => [
  { kind: 'tag', title: t('settings.tagFilterHistory'), list: tagHistory.value },
  { kind: 'text', title: t('settings.textFilterHistory'), list: textHistory.value }
])
function fhAdd(kind) {
  if (addFilterHistory(kind, fhDraft[kind])) fhDraft[kind] = ''
}

// ---------- 语言包 ----------
async function onLanguageChange() {
  setKeycodeMode(cfg.value.keycodeLangMode || 'follow')
  await loadI18n(cfg.value.lang || 'zh-CN', true)
  saveCfg()
}
function onKeycodeModeChange() {
  setKeycodeMode(cfg.value.keycodeLangMode || 'follow')
  saveCfg()
}
function onThemeChange() {
  applyTheme(cfg.value.theme)
  // applyTheme 已通过 onThemeResolved 通知日志配色同步；这里再兜一次，保证独立调用也生效（幂等）。
  syncLogColorsForTheme(document.documentElement.dataset.theme)
  saveCfg()
}
function reloadLangPacks() {
  return loadI18n(cfg.value.lang || locale.value, true)
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 导出全量语言模板：中文原文作注释与默认值，locale 留空 → 加载器视为模板跳过，
// 用户必须显式填 locale 才生效，避免模板留在目录里覆盖当前语言。
async function exportLangTemplate() {
  const base = { ...flatten(zhCN) }
  for (const [k, v] of Object.entries(flatten(keycodeZh))) base['keycode.' + k] = v
  const grouped = {}
  for (const [key, value] of Object.entries(base)) {
    const section = key.split('.').slice(0, 2).join('.')
    if (!grouped[section]) grouped[section] = []
    grouped[section].push(`  <!-- ${escapeXml(value)} -->\n  <string name="${key}">${escapeXml(value)}</string>`)
  }
  const body = Object.entries(grouped)
    .map(([section, lines]) => `  <!-- ===== ${section} ===== -->\n${lines.join('\n')}`)
    .join('\n\n')
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<!-- ADB++ 语言模板：填写 locale 与 name，删掉文件名里的 -template，放到 adbtool-config.json 同目录。\n'
    + '     缺的词条自动回退内置语言。改完点「重新加载语言包」即可生效。 -->\n'
    + '<resources locale="" name="" fallback="en-US">\n' + body + '\n</resources>\n'
  const p = await api.invoke('file:saveText', {
    content: xml,
    defaultPath: 'adbplusplus-lang-template.xml',
    filters: [{ name: t('common.xmlTemplate'), extensions: ['xml'] }]
  })
  if (p) showResult(t('settings.exportTemplate'), t('toast.exported') + p, true)
}
</script>

<template>
  <div v-if="settingsOpen" class="modal-mask" @click.self="maskClose(() => settingsOpen = false)">
    <div class="modal settings-modal">
      <div class="modal-head">
        {{ t('menu.settings') }}
        <button class="modal-x" @click="settingsOpen = false">×</button>
      </div>
      <div class="settings-body">
        <div class="settings-tabs">
          <button :class="{ active: settingsTab === 'general' }" @click="setTab('general')">{{ t('settings.general') }}</button>
          <button :class="{ active: settingsTab === 'lang' }" @click="setTab('lang')">{{ t('settings.langPack') }}</button>
          <button :class="{ active: settingsTab === 'win' }" @click="setTab('win')">{{ t('settings.window') }}</button>
          <button :class="{ active: settingsTab === 'applog' }" @click="setTab('applog')">{{ t('settings.appLog') }}</button>
          <button :class="{ active: settingsTab === 'font' }" @click="setTab('font')">{{ t('settings.font') }}</button>
          <button :class="{ active: settingsTab === 'colors' }" @click="setTab('colors')">{{ t('settings.colors') }}</button>
          <button :class="{ active: settingsTab === 'contentcolor' }" @click="setTab('contentcolor')">{{ t('settings.contentColor') }}</button>
          <button :class="{ active: settingsTab === 'autolog' }" @click="setTab('autolog')">{{ t('settings.autoLog') }}</button>
          <button :class="{ active: settingsTab === 'filterhistory' }" @click="setTab('filterhistory')">{{ t('settings.filterHistory') }}</button>
          <button :class="{ active: settingsTab === 'capture' }" @click="setTab('capture')">{{ t('settings.capture') }}</button>
          <button :class="{ active: settingsTab === 'offlinelog' }" @click="setTab('offlinelog')">{{ t('settings.offlineLog') }}</button>
          <button :class="{ active: settingsTab === 'shot' }" @click="setTab('shot')">{{ t('settings.screenshot') }}</button>
        </div>
        <div class="settings-content">
          <div v-if="settingsTab === 'colors'">
            <div class="color-head">
              <p class="muted small">{{ t('settings.colorsHint') }}</p>
              <div class="color-reset-row"><button class="outdir-btn" @click="resetLogColors">{{ t('common.resetDefault') }}</button></div>
            </div>
            <div class="color-grid">
              <label v-for="lv in levelList" :key="lv.key" class="color-row">
                <span class="color-name">{{ lv.label }}</span>
                <input type="color" v-model="logColors[lv.key]" @change="onLogColorChange" />
                <input type="text" class="color-hex-input" :value="logColors[lv.key]" @input="onHexInput(lv.key, $event.target.value)" maxlength="7" spellcheck="false" />
                <span class="color-bold"><input type="checkbox" v-model="logColorBold[lv.key]" @change="onLogColorChange" /> {{ t('common.bold') }}</span>
                <span class="color-bg"><input type="checkbox" v-model="logBgOn[lv.key]" @change="onLogColorChange" /> {{ t('color.background') }}</span>
                <input type="color" v-model="logBgColors[lv.key]" :disabled="!logBgOn[lv.key]" @change="onLogColorChange" />
                <input type="text" class="color-hex-input" :value="logBgColors[lv.key]" :disabled="!logBgOn[lv.key]" @input="onBgInput(lv.key, $event.target.value)" maxlength="7" spellcheck="false" />
              </label>
            </div>
          </div>
          <div v-if="settingsTab === 'autolog'" class="autolog-box">
            <label class="switch-row">
              <input type="checkbox" v-model="autoLog" @change="onAutoLogChange" />
              <span>{{ t('settings.autoLogHint') }}</span>
            </label>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.savePath') }}</span>
              <input class="outdir-input" :value="cfg.outDir" readonly />
              <button class="outdir-btn" @click="browseOutDir">{{ t('common.browse') }}</button>
            </div>
            <p class="muted small">{{ t('settings.autoLogDesc', { dir: cfg.outDir }) }}</p>
          </div>
          <div v-if="settingsTab === 'filterhistory'" class="fh-settings-box">
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.historyMax') }}</span>
              <input class="font-input" type="number" min="1" max="200" step="1" v-model.number="cfg.filterHistoryMax" @change="onFilterHistoryMaxChange" />
              <span class="muted small">{{ t('settings.historyMaxHint') }}</span>
            </div>
            <p class="muted small">{{ t('settings.filterHistoryDesc') }}</p>
            <div v-for="sect in fhSections" :key="sect.kind" class="fh-sect">
              <div class="fh-sect-head">
                <strong>{{ sect.title }}</strong>
                <span class="muted small">{{ t('settings.historyCount', { n: sect.list.length }) }}</span>
              </div>
              <div class="fh-add-row">
                <input class="outdir-input" v-model="fhDraft[sect.kind]" :placeholder="t('settings.historyAdd') + sect.title" spellcheck="false" @keydown.enter="fhAdd(sect.kind)" />
                <button class="outdir-btn" @click="fhAdd(sect.kind)">{{ t('common.add') }}</button>
                <button class="outdir-btn" @click="clearFilterHistory(sect.kind)">{{ t('settings.historyClear') }}</button>
              </div>
              <div class="fh-list">
                <div v-if="!sect.list.length" class="fh-empty">{{ t('settings.noHistory') }}</div>
                <div v-for="h in sect.list" :key="h.text" class="fh-row" :class="{ locked: h.locked }">
                  <button class="fh-lock-btn" :class="{ active: h.locked }"
                          :title="h.locked ? t('settings.lockedHint') : t('settings.lockHint')"
                          @click="toggleFilterHistoryLock(sect.kind, h.text)">{{ h.locked ? t('settings.locked') : t('settings.lock') }}</button>
                  <span class="fh-row-text" :title="h.text">{{ h.text }}</span>
                  <button class="fh-del-btn" :disabled="h.locked"
                          :title="h.locked ? t('settings.lockedNoDelete') : t('settings.deleteEntry')"
                          @click="removeFilterHistory(sect.kind, h.text)">{{ t('common.delete') }}</button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="settingsTab === 'contentcolor'" class="contentcolor-box">
            <div class="contentcolor-head">
              <span class="muted small">{{ t('settings.contentColorDesc') }}</span>
              <button class="outdir-btn" @click="openAddColorRule('global')">{{ t('common.addNew') }}</button>
            </div>
            <ColorRulesTable :items="globalColorRulesView" />
          </div>
          <div v-if="settingsTab === 'lang'" class="lang-box">
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.language') }}</span>
              <AppSelect v-model="cfg.lang" class="lang-select" @change="onLanguageChange"
                         :options="locales.map(l => ({ value: l.id, label: l.name + '（' + (l.builtin ? t('settings.builtin') : t('settings.external')) + '）' }))" />
            </div>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.keycodeLang') }}</span>
              <AppSelect v-model="cfg.keycodeLangMode" class="lang-select" @change="onKeycodeModeChange"
                         :options="[{ value: 'follow', label: t('settings.keycodeFollow') }, { value: 'en', label: t('settings.keycodeEn') }]" />
            </div>
            <p class="muted small">{{ t('settings.scanDir', { dir: scanDir }) }}</p>
            <div class="general-io">
              <button class="outdir-btn" @click="exportLangTemplate">{{ t('settings.exportTemplate') }}</button>
              <button class="outdir-btn" @click="reloadLangPacks">{{ t('settings.reloadPacks') }}</button>
            </div>
            <p v-if="missingCount" class="muted small">{{ t('settings.missingCount', { n: missingCount }) }}</p>
            <div v-if="warnings.length" class="lang-warnings">
              <strong>{{ t('settings.warnings') }}（{{ warnings.length }}）</strong>
              <div v-for="(w, i) in warnings.slice(0, 10)" :key="i" class="lang-warning">{{ w }}</div>
              <div v-if="warnings.length > 10" class="muted small">… {{ warnings.length - 10 }}</div>
            </div>
          </div>
          <div v-if="settingsTab === 'general'" class="general-box">
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.theme') }}</span>
              <AppSelect v-model="cfg.theme" class="theme-select" @change="onThemeChange"
                         :options="[{ value: 'system', label: t('settings.themeSystem') }, { value: 'light', label: t('settings.themeLight') }, { value: 'dark', label: t('settings.themeDark') }]" />
            </div>
            <p class="muted small">{{ t('settings.themeDesc') }}</p>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.maxRender') }}</span>
              <input class="font-input" type="number" min="1000" max="3000" step="1000" v-model.number="cfg.maxRender" @change="onMaxRenderChange" />
            </div>
            <p class="muted small">{{ t('settings.maxRenderDesc') }}</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.cursorMoveNoScroll" @change="saveCfg" />
              <span>{{ t('settings.cursorNoScroll') }}</span>
            </label>
            <p class="muted small">{{ t('settings.cursorDesc') }}</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.checkUpdateOnStartup" @change="saveCfg" />
              <span>{{ t('settings.checkUpdate') }}</span>
            </label>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.autoReconnect" @change="onAutoReconnectChange" />
              <span>ADB 断线自动重连（默认开启）</span>
            </label>
            <p class="muted small">网络设备非人工断开时自动重连，直到恢复；手动关闭、断开、取消连接不会被重连。USB 设备无法用 adb 重连，需重新插拔。</p>
            <div v-if="cfg.autoReconnect" class="outdir-row">
              <span class="outdir-label">重连间隔（秒）</span>
              <input class="font-input" type="number" min="1" max="3600" step="1" v-model.number="cfg.autoReconnectInterval" @change="onAutoReconnectChange" />
              <span class="muted small">{{ t('settings.autoReconnectIntervalHint') }}</span>
            </div>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.configPath') }}</span>
              <input class="outdir-input" :value="cfg.configPath || t('settings.defaultConfigPath')" readonly />
              <button class="outdir-btn" @click="browseConfigPath">{{ t('common.browse') }}</button>
            </div>
            <p class="muted small">{{ t('settings.configPathDesc', { path: cfg.configPath || t('settings.defaultConfigPath') }) }}</p>
            <div class="general-io">
              <button class="outdir-btn" @click="exportSettings">{{ t('settings.exportSettings') }}</button>
              <button class="outdir-btn" @click="importSettings">{{ t('settings.importSettings') }}</button>
            </div>
            <p class="muted small">{{ t('settings.ioDesc') }}</p>
          </div>
          <div v-if="settingsTab === 'applog'" class="applog-box">
            <label class="switch-row">
              <input type="checkbox" v-model="appLogEnabled" @change="onAppLogChange" />
              <span>{{ t('settings.appLogHint') }}</span>
            </label>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.savePath') }}</span>
              <input class="outdir-input" :value="cfg.appLogDir" readonly />
              <button class="outdir-btn" @click="browseAppLogDir">{{ t('common.browse') }}</button>
            </div>
            <p class="muted small">{{ t('settings.appLogDesc', { dir: cfg.appLogDir }) }}</p>
          </div>
          <div v-if="settingsTab === 'font'" class="font-box">
            <label class="switch-row">
              <span>{{ t('settings.fontSize') }}</span>
              <input type="number" min="8" max="32" step="1" v-model.number="logFont.size" @change="onFontChange" />
              <span class="muted small">px（8~32）</span>
            </label>
            <div class="switch-row">
              <span>{{ t('settings.fontFamily') }}</span>
              <div class="font-picker">
                <input type="text" class="font-input" v-model="fontQuery" spellcheck="false"
                       :placeholder="t('settings.fontPlaceholder')" @focus="openFontPicker" @input="fontPickerOpen = true" />
                <div v-if="fontPickerOpen" class="font-dropdown">
                  <div v-for="o in filteredFonts" :key="o.value" class="font-opt"
                       :class="{ active: o.value === logFont.family }" :title="o.label"
                       @click="pickFont(o)">{{ o.label }}</div>
                  <div v-if="!filteredFonts.length" class="font-empty">{{ t('settings.noFont') }}</div>
                </div>
              </div>
            </div>
            <label class="switch-row">
              <input type="checkbox" v-model="logFont.bold" @change="onFontChange" />
              <span>{{ t('color.bold') }}</span>
            </label>
            <label class="switch-row">
              <span>{{ t('settings.lineHeight') }}</span>
              <input type="number" min="1" max="3" step="0.1" v-model.number="logFont.lineHeight" @change="onFontChange" />
              <span class="muted small">{{ t('settings.lineHeightHint') }}</span>
            </label>
            <div class="font-preview" :style="logFontStyle">I/Hello World 2018-02-07 06:16:28.555 com.example.sample: sample log line</div>
            <p class="muted small">{{ t('settings.effectiveImmediately') }}</p>
          </div>
          <div v-if="settingsTab === 'win'" class="win-box">
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.closeOnOuterClick" @change="saveCfg" />
              <span>{{ t('settings.closeOnOuter') }}</span>
            </label>
            <p class="muted small">{{ t('settings.closeOnOuterDesc') }}</p>
            <div class="bg-section">
              <label class="switch-row">
                <input type="checkbox" v-model="cfg.bgEnabled" @change="onBgToggle" />
                <span>{{ t('settings.bgMaster') }}</span>
              </label>
              <p class="muted small">{{ t('settings.bgMasterDesc') }}</p>
              <div class="outdir-row">
                <span class="outdir-label">{{ t('settings.bgImage') }}</span>
                <button class="ghost" :disabled="!cfg.bgEnabled" @click="onBgPick">{{ t('settings.bgPick') }}</button>
                <button class="ghost" :disabled="!cfg.bgEnabled || !cfg.bgImage" @click="onBgClear">{{ t('common.clear') }}</button>
                <button class="ghost" :disabled="!cfg.bgEnabled" @click="onBgReset">{{ t('settings.bgReset') }}</button>
              </div>
              <p class="muted small">{{ cfg.bgImage || t('settings.bgNoImage') }}</p>
              <p class="muted small">{{ t('settings.bgImageHint') }}</p>
              <div v-for="z in bgZoneDefs" :key="z.key" class="bg-zone">
                <label class="switch-row">
                  <input type="checkbox" v-model="cfg.bgZones[z.key].enabled" :disabled="!cfg.bgEnabled" @change="onBgToggle" />
                  <span>{{ t(z.labelKey) }}</span>
                </label>
                <div class="outdir-row">
                  <span class="outdir-label">{{ t('settings.bgColor') }}</span>
                  <input type="color" :value="cfg.bgZones[z.key].color || z.fallback" :disabled="!cfg.bgEnabled || !cfg.bgZones[z.key].enabled" @input="onBgColor(z.key, $event.target.value)" />
                  <input type="text" class="color-hex-input" :value="cfg.bgZones[z.key].color" :disabled="!cfg.bgEnabled || !cfg.bgZones[z.key].enabled" @input="onBgColor(z.key, $event.target.value)" maxlength="7" spellcheck="false" />
                </div>
                <div class="outdir-row">
                  <span class="outdir-label">{{ t('settings.bgAlpha') }}</span>
                  <input type="range" min="0" max="100" :value="cfg.bgZones[z.key].alpha" :disabled="!cfg.bgEnabled || !cfg.bgZones[z.key].enabled" @input="onBgAlpha(z.key, $event.target.value)" />
                  <span class="muted small">{{ cfg.bgZones[z.key].alpha }}%</span>
                </div>
                <p v-if="z.key === 'log'" class="muted small">{{ t('settings.bgLogHint') }}</p>
              </div>
            </div>
          </div>
          <div v-if="settingsTab === 'capture'" class="capture-box">
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.tcpdumpArgs') }}</span>
              <input class="outdir-input" v-model="cfg.captureArgs" @change="saveCfg" spellcheck="false" />
            </div>
            <p class="muted small">{{ t('settings.tcpdumpDesc') }}</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.captureAsRoot" @change="saveCfg" />
              <span>{{ t('settings.captureRoot') }}</span>
            </label>
            <p class="muted small">{{ t('settings.captureRootDesc') }}</p>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.captureDeviceDir') }}</span>
              <input class="outdir-input" v-model="cfg.captureDeviceDir" @change="saveCfg" spellcheck="false" />
            </div>
            <p class="muted small">{{ t('settings.captureDeviceDirDesc') }}</p>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.captureLocalDir') }}</span>
              <input class="outdir-input" :value="cfg.captureLocalDir" readonly />
              <button class="outdir-btn" @click="browseCaptureLocalDir">{{ t('common.browse') }}</button>
            </div>
            <p class="muted small">{{ t('settings.captureLocalDirDesc', { dir: cfg.outDir }) }}</p>
          </div>
          <div v-if="settingsTab === 'offlinelog'" class="capture-box">
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.logcatArgs') }}</span>
              <input class="outdir-input" v-model="cfg.offlineLogArgs" @change="saveCfg" spellcheck="false" />
            </div>
            <p class="muted small">{{ t('settings.logcatArgsDesc') }}</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.offlineLogAsRoot" @change="saveCfg" />
              <span>{{ t('settings.offlineLogRoot') }}</span>
            </label>
            <p class="muted small">{{ t('settings.offlineLogRootDesc') }}</p>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.offlineLogDeviceDir') }}</span>
              <input class="outdir-input" v-model="cfg.offlineLogDeviceDir" @change="saveCfg" spellcheck="false" />
            </div>
            <p class="muted small">{{ t('settings.offlineLogDeviceDirDesc') }}</p>
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.offlineLogLocalDir') }}</span>
              <input class="outdir-input" :value="cfg.offlineLogLocalDir" readonly />
              <button class="outdir-btn" @click="browseOfflineLogLocalDir">{{ t('common.browse') }}</button>
            </div>
            <p class="muted small">{{ t('settings.offlineLogLocalDirDesc', { dir: cfg.outDir }) }}</p>
          </div>
          <div v-if="settingsTab === 'shot'" class="shot-box">
            <div class="outdir-row">
              <span class="outdir-label">{{ t('settings.screenshotDir') }}</span>
              <input class="outdir-input" :value="cfg.screenshotDir" readonly />
              <button class="outdir-btn" @click="browseScreenshotDir">{{ t('common.browse') }}</button>
            </div>
            <p class="muted small">{{ t('settings.screenshotDirDesc') }}</p>
            <label class="switch-row">
              <span>{{ t('settings.screenshotInterval') }}</span>
              <input type="number" min="200" max="60000" step="100" v-model.number="cfg.screenshotInterval" @change="saveCfg" />
              <span class="muted small">{{ t('settings.shotIntervalHint') }}</span>
            </label>
            <p class="muted small">{{ t('settings.shotIntervalDesc') }}</p>
          </div>
        </div>
      </div>
      <div class="modal-foot"><button class="primary" @click="settingsOpen = false">{{ t('common.close') }}</button></div>
    </div>
  </div>
</template>
