// 主进程 i18n：外部语言包扫描 / 解析 / 校验 / 合并，以及错误消息翻译。
// 关键约束：app 启动阶段只登记目录，不扫盘不解析；首次 IPC 请求才懒加载（见设计 §4.10）。
import fs from 'node:fs'
import path from 'node:path'
import { flatten, createTranslator } from '../shared/i18n/translate.js'
import { parseXmlLangPack, parseJsonLangPack, validateEntries } from '../shared/i18n/langpack.js'
import zhCN from '../shared/i18n/locales/zh-CN.js'
import enUS from '../shared/i18n/locales/en-US.js'
import keycodeZh from '../shared/i18n/locales/keycode.zh-CN.js'
import keycodeEn from '../shared/i18n/locales/keycode.en-US.js'

const MAX_FILE_SIZE = 256 * 1024
const MAX_FILES = 64
const MAX_ENTRIES = 5000
const MAX_VALUE_LEN = 2000

function prefixKeys(dict, prefix) {
  const out = {}
  for (const [k, v] of Object.entries(dict)) out[prefix + k] = v
  return out
}

// 校验基准：内置 zh-CN 全量（含 keycode），外部包永远不能扩充 key 空间。
export const BASE_DICT = flatten(zhCN)

function builtinDict(localeModule, keycodeModule) {
  return { ...flatten(localeModule), ...prefixKeys(flatten(keycodeModule), 'keycode.') }
}

const BUILTIN = {
  'zh-CN': builtinDict(zhCN, keycodeZh),
  'en-US': builtinDict(enUS, keycodeEn)
}

let configDir = ''
let currentId = 'zh-CN'
let currentDict = { ...BUILTIN['zh-CN'] }
let fallbackDict = {}
let currentFallbackId = 'zh-CN'
let mainTranslate = createTranslator(currentDict, {}, null)
let lastSignature = ''
let scanned = false
let catalog = []
const packCache = new Map()   // 文件路径 → { locale, name, fallback, entries, warnings, mtimeMs, size }
let allWarnings = []

// 系统 locale → 内置语言 id。纯函数，便于单测；设计约定 zh* → zh-CN，其余 → en-US。
// 外部语言包（如 ja-JP）不会被自动选中：没有对应的系统 locale，必须由用户显式设置。
export function localeFromSystem(loc) {
  return String(loc || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

// 只登记目录与首选语言；不触碰磁盘。
export function initMainI18n(dir, lang) {
  configDir = dir || ''
  currentId = lang || 'zh-CN'
}

// 配置保存后同步主进程语言；首次加载尚未发生时只记 id，首次取词时会按它加载。
export function setMainLocale(lang) {
  if (!lang || lang === currentId) return
  currentId = lang
  if (scanned) loadLocale(lang, false)
}

// 主进程用户可见错误消息翻译（参数校验 throw 与 console 日志不走这里）。
export function mt(key, params) { return mainTranslate(key, params) }

// 目录项扫描：只读 readdir + lstat/stat 的 mtime/size，不读文件内容。
// lstat 拒绝符号链接与目录；路径必须仍在 configDir 内（防 .. 逃逸）。
function listLangFiles() {
  if (!configDir) return []
  const out = []
  let names = []
  try { names = fs.readdirSync(configDir) } catch { return [] }
  const root = path.resolve(configDir) + path.sep
  for (const name of names) {
    if (!/\.xml$/i.test(name) && !/\.lang\.json$/i.test(name)) continue
    if (name === 'adbtool-config.json') continue
    const full = path.resolve(configDir, name)
    if (!full.startsWith(root)) { allWarnings.push(mt('langwarn.pathEscape', { name })); continue }
    try {
      const lst = fs.lstatSync(full)
      if (!lst.isFile() || lst.isSymbolicLink()) continue
      const st = fs.statSync(full)
      if (st.size > MAX_FILE_SIZE) { allWarnings.push(mt('langwarn.tooLarge', { name })); continue }
      out.push({ path: full, name, mtimeMs: st.mtimeMs, size: st.size })
    } catch {}
  }
  if (out.length > MAX_FILES) {
    allWarnings.push(mt('langwarn.tooMany', { n: MAX_FILES }))
    out.length = MAX_FILES
  }
  return out
}

function signatureOf(files) {
  return files.map(f => `${f.path}|${f.mtimeMs}|${f.size}`).join('\n')
}

// 解析单个语言包；任何结构错误返回带 warning 的空包，不影响其它文件。
function parseOne(file) {
  try {
    const text = fs.readFileSync(file.path, 'utf8')
    if (Buffer.byteLength(text, 'utf8') > MAX_FILE_SIZE) throw new Error('解码后超过 256KB')
    const parsed = /\.xml$/i.test(file.name) ? parseXmlLangPack(text) : parseJsonLangPack(text)
    const entries = parsed.entries || {}
    const count = Object.keys(entries).length
    if (count > MAX_ENTRIES) throw new Error(`词条超过 ${MAX_ENTRIES} 条`)
    for (const [k, v] of Object.entries(entries)) {
      if (typeof v !== 'string' && v != null) throw new Error(`key「${k}」不是文本`)
      if (typeof v === 'string' && v.length > MAX_VALUE_LEN) throw new Error(`key「${k}」超过 2000 字符`)
    }
    const checked = validateEntries(entries, BASE_DICT, file.name)
    return {
      locale: parsed.locale, name: parsed.name, fallback: parsed.fallback,
      entries: checked.accepted,
      warnings: checked.warnings.concat(parsed.ignored && parsed.ignored.length
        ? [mt('langwarn.ignoredNodes', { name: file.name, nodes: [...new Set(parsed.ignored)].join(', ') })] : []),
      mtimeMs: file.mtimeMs, size: file.size
    }
  } catch (e) {
    return {
      locale: '', name: '', fallback: '', entries: {},
      warnings: [mt('langwarn.parseFailed', { name: file.name, reason: e.message || '' })],
      mtimeMs: file.mtimeMs, size: file.size
    }
  }
}

function buildCatalog() {
  const byId = new Map()
  for (const [id, name] of [['zh-CN', '简体中文'], ['en-US', 'English']]) {
    byId.set(id, { id, name, builtin: true, files: [], warnings: [] })
  }
  for (const [filePath, pack] of packCache) {
    if (!pack.locale) {
      // locale 为空：可能是导出模板，也可能是解析失败。告警必须让用户在设置面板看见，不能静默吞掉。
      allWarnings.push(...pack.warnings)
      continue
    }
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(pack.locale)) {
      allWarnings.push(mt('langwarn.invalidLocale', { name: path.basename(filePath) }))
      continue
    }
    const id = pack.locale
    let item = byId.get(id)
    if (!item) {
      item = { id, name: pack.name || id, builtin: false, files: [], warnings: [] }
      byId.set(id, item)
    } else if (!item.builtin && pack.name) item.name = pack.name
    item.files.push(filePath)
    item.warnings.push(...pack.warnings)
  }
  for (const item of byId.values()) item.files.sort()
  catalog = [...byId.values()]
  allWarnings = [...new Set(allWarnings.concat(...catalog.map(x => x.warnings)))]
}

// 首次调用或 force 时扫盘；mtime 未变的文件沿用缓存。
function ensureScan(force) {
  allWarnings = []
  const files = listLangFiles()
  const sig = signatureOf(files)
  if (!force && scanned && sig === lastSignature) return
  for (const f of files) {
    const cached = packCache.get(f.path)
    if (!force && cached && cached.mtimeMs === f.mtimeMs && cached.size === f.size) continue
    packCache.set(f.path, parseOne(f))
  }
  for (const key of [...packCache.keys()]) if (!files.some(f => f.path === key)) packCache.delete(key)
  buildCatalog()
  lastSignature = sig
  scanned = true
}

function countMissing(dict, fb) {
  let n = 0
  for (const key of Object.keys(BASE_DICT)) {
    if (!Object.prototype.hasOwnProperty.call(dict, key) && !Object.prototype.hasOwnProperty.call(fb, key)) n++
  }
  return n
}

// 返回给渲染层的目录信息（不暴露文件路径与体积等内部字段）。
export function getCatalog() {
  ensureScan(false)
  return {
    locales: catalog.map(({ id, name, builtin, warnings }) => ({ id, name, builtin, warnings })),
    current: currentId,
    warnings: allWarnings,
    scanDir: configDir
  }
}

// 加载指定语言的合并字典。force=true 时重扫磁盘（改完外部文件立即生效）。
export function loadLocale(id, force = false) {
  ensureScan(force)
  const item = catalog.find(x => x.id === id) || catalog.find(x => x.id === 'zh-CN')
  const targetId = item ? item.id : 'zh-CN'
  const files = item ? item.files : []
  const ext = {}
  for (const f of files) Object.assign(ext, packCache.get(f).entries)

  let fallbackId = files.map(f => packCache.get(f).fallback).find(Boolean) || ''
  if (!fallbackId || fallbackId === targetId || !catalog.some(x => x.id === fallbackId)) fallbackId = 'zh-CN'

  // 外部新语言没有内置同名字典时不能塞入 zh-CN：那会让声明的 fallback 永远命中不到。
  // 正确链路是「外部包 → fallback → zh-CN」，由 t() 的字典查找逐级完成。
  const builtin = BUILTIN[targetId] || {}
  currentDict = { ...builtin, ...ext }
  fallbackDict = BUILTIN[fallbackId] || {}
  currentFallbackId = fallbackId
  currentId = targetId
  mainTranslate = createTranslator(currentDict, fallbackDict, (key) => {
    if (process.env.ELECTRON_DEV) console.warn('[i18n] missing key: ' + key)
  })

  // KEYCODE「始终英文」模式需要一份合并后的英文 keycode 字典（含外部 en-US 包覆盖）。
  const enItem = catalog.find(x => x.id === 'en-US')
  const enExt = {}
  for (const f of (enItem && enItem.files) || []) Object.assign(enExt, packCache.get(f).entries)
  const keycodeEn = {}
  for (const [k, v] of Object.entries({ ...BUILTIN['en-US'], ...enExt })) {
    if (k.startsWith('keycode.')) keycodeEn[k] = v
  }

  return {
    id: targetId,
    name: item ? item.name : targetId,
    dict: currentDict,
    fallbackDict,
    keycodeEn,
    fallbackId: currentFallbackId,
    missing: countMissing(currentDict, fallbackDict),
    catalog: catalog.map(({ id: i, name, builtin: b, warnings }) => ({ id: i, name, builtin: b, warnings })),
    warnings: allWarnings,
    scanDir: configDir
  }
}
