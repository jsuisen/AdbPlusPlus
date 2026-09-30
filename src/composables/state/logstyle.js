// 共享状态：日志外观（级别颜色 / 内容颜色规则 / 字体）
import { ref, reactive, computed } from 'vue'
import { DEFAULT_LOG_COLORS, DEFAULT_LOG_COLOR_BOLD, DEFAULT_LOG_BG_COLORS, DEFAULT_LOG_BG_ON, DEFAULT_LOG_FONT } from './core.js'
import { activeLogSerial } from './devices.js'

export const levelList = [
  { key: 'V', label: 'verbose' },
  { key: 'D', label: 'debug' },
  { key: 'I', label: 'info' },
  { key: 'W', label: 'warn' },
  { key: 'E', label: 'error' },
  { key: 'F', label: 'fatal' }
]

export const logColors = reactive({ ...DEFAULT_LOG_COLORS })

export const logColorBold = reactive({ ...DEFAULT_LOG_COLOR_BOLD })

export const logBgColors = reactive({ ...DEFAULT_LOG_BG_COLORS })

export const logBgOn = reactive({ ...DEFAULT_LOG_BG_ON })

// 全局内容颜色规则（随配置持久化）
export const logColorRules = ref([])

// 当前会话（按设备）的关键字上色规则（不持久化）；切换设备即独立一份
export const colorSessionMap = reactive({})

// 当前会话内对「全局规则」启用状态(是否生效)的临时覆盖：{[serial]:{[keyword]:bool}}，不持久化、不影响全局配置
export const colorSessionEnabled = reactive({})

export const logFont = reactive({ ...DEFAULT_LOG_FONT })

export const fontNames = ref(['Cascadia Code', 'Consolas', 'Courier New', 'Microsoft YaHei'])

export const fontQuery = ref('')

export const fontPickerOpen = ref(false)

// 选项：第一项为系统默认等宽，其余为系统字体；value 直接是可用的 CSS font-family 串
export const fontOptions = computed(() => [
  { label: '系统默认等宽', value: 'monospace' },
  ...fontNames.value.map((n) => ({ label: n, value: `"${n}", monospace` }))
])

// 当前字体在列表中的显示名；未命中则回退取 family 的第一段字体名
export const currentFontLabel = computed(() => {
  const hit = fontOptions.value.find((o) => o.value === logFont.family)
  if (hit) return hit.label
  return (logFont.family || '').split(',')[0].replace(/["']/g, '').trim() || 'monospace'
})

// 筛选：输入为空或仍等于当前显示名（未修改）时展示全部，否则按关键字过滤
export const filteredFonts = computed(() => {
  const q = fontQuery.value.trim()
  if (!q || q === currentFontLabel.value) return fontOptions.value
  const lq = q.toLowerCase()
  return fontOptions.value.filter((o) => o.label.toLowerCase().includes(lq))
})

export const logFontStyle = computed(() => ({
  'font-family': logFont.family,
  'font-size': (logFont.size || 12) + 'px',
  'font-weight': logFont.bold ? '700' : '400',
  'line-height': (logFont.lineHeight || 1.4)
}))

// ---------- 内容颜色规则弹窗（新增/修改规则） ----------
export const colorModalOpen = ref(false)

export const colorModalEditId = ref(null)

export const colorModalScope = ref('global')   // 'global' | 'session'

export const colorDraft = reactive({ keyword: '', byTag: false, byMsg: false, color: '#FF0000', bold: false, enabled: true, bgColor: '#FFFFFF', bgOn: true })

export const colorDraftErr = ref('')

// 日志窗口「颜色」弹窗（全局 + 本会话规则合并展示）
export const colorWinOpen = ref(false)

export const globalColorRulesView = computed(() => logColorRules.value.map(r => ({ scope: 'global', rule: r })))

export const combinedColorRules = computed(() => {
  const s = activeLogSerial.value
  const session = (colorSessionMap[s] || []).map(r => ({ scope: 'session', rule: r }))
  const global = logColorRules.value.map(r => ({ scope: 'global', rule: r }))
  return [...session, ...global]
})
