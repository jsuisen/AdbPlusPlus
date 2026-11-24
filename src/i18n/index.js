// 渲染层 i18n：响应式 locale + t()。
// 独立于 state 桶，避免 state/core → i18n → state 成环；组件从 '@/i18n' 直接 import。
import { ref } from 'vue'
import { createTranslator } from '@shared/i18n/translate.js'

export const locale = ref('zh-CN')
export const localeName = ref('简体中文')
export const keycodeLangMode = ref('follow')   // 'follow' | 'en'，与 cfg.keycodeLangMode 同步
export const locales = ref([])
export const warnings = ref([])
export const missingCount = ref(0)
export const scanDir = ref('')

let translate = createTranslator({}, {}, null)
let keycodeEn = {}

// 主进程 I18N_LOAD 的结果整体灌入。先换字典再改 locale.value，避免读到新语言配旧字典。
export function setLocale(data) {
  if (!data) return
  const dict = data.dict || {}
  const fb = data.fallbackDict || {}
  translate = createTranslator(dict, fb, null)
  keycodeEn = data.keycodeEn || {}
  locales.value = data.catalog || []
  warnings.value = data.warnings || []
  missingCount.value = Number(data.missing) || 0
  scanDir.value = data.scanDir || ''
  localeName.value = data.name || data.id || ''
  locale.value = data.id || 'zh-CN'
}

export function setKeycodeMode(mode) {
  keycodeLangMode.value = mode === 'en' ? 'en' : 'follow'
}

// 模板/computed 中调用即建立对 locale 的响应式依赖（读 locale.value 是刻意的）。
export function t(key, params) {
  const _current = locale.value
  return translate(key, params)
}

// KEYCODE 描述：跟随界面用当前字典，'en' 用主进程提供的合并英文 keycode 字典。
export function tKeycode(name) {
  const _mode = keycodeLangMode.value
  const key = 'keycode.' + name
  if (keycodeLangMode.value === 'en' && Object.prototype.hasOwnProperty.call(keycodeEn, key)) return keycodeEn[key]
  return t(key)
}
