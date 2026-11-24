// 外部语言包解析与校验（纯函数，无 Node / Vue 依赖）。
// 支持扁平 strings.xml 子集与 *.lang.json。任何结构错误整文件拒绝，不做半解析。
import { extractPlaceholders } from './translate.js'

const ENTITY_NAMES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function decodeEntity(ent) {
  if (/^#x[0-9a-fA-F]+$/.test(ent)) {
    try { return String.fromCodePoint(parseInt(ent.slice(2), 16)) } catch { return '&' + ent + ';' }
  }
  if (/^#\d+$/.test(ent)) {
    try { return String.fromCodePoint(parseInt(ent.slice(1), 10)) } catch { return '&' + ent + ';' }
  }
  if (Object.prototype.hasOwnProperty.call(ENTITY_NAMES, ent)) return ENTITY_NAMES[ent]
  return '&' + ent + ';'   // 未知实体保留原文，绝不尝试外部解析
}

function parseAttrs(tagBody) {
  const attrs = {}
  for (const m of String(tagBody).matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[m[1]] = m[2] !== undefined ? m[2] : m[3]
  }
  return attrs
}

// 读取 <string> 的值，支持 CDATA 与预定义/数字实体；遇到嵌套标签或实体未闭合即整文件失败。
function readStringValue(src, start) {
  let out = ''
  let i = start
  while (i < src.length) {
    if (src.startsWith('</string>', i)) return { value: out, end: i + '</string>'.length }
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + '<![CDATA['.length)
      if (end < 0) throw new Error('CDATA 未闭合')
      out += src.slice(i + '<![CDATA['.length, end)
      i = end + 3
      continue
    }
    if (src[i] === '<') throw new Error('<string> 值内出现非法标签')
    if (src[i] === '&') {
      const semi = src.indexOf(';', i + 1)
      if (semi < 0 || semi - i > 16) throw new Error('实体未闭合')
      out += decodeEntity(src.slice(i + 1, semi))
      i = semi + 1
      continue
    }
    out += src[i]
    i++
  }
  throw new Error('<string> 未闭合')
}

// 解析 strings.xml 子集。返回 { locale, name, fallback, entries, ignored }。
// 安全：DOCTYPE / ENTITY / 处理指令一律拒绝，杜绝本地文件读取（XXE / 实体膨胀）。
export function parseXmlLangPack(text) {
  const src = String(text)
  if (/<!DOCTYPE|<!ENTITY/i.test(src)) throw new Error('XML 外部实体被禁止')
  if (/<\?(?!xml\b)/i.test(src)) throw new Error('XML 处理指令被禁止')

  let s = src.replace(/^\uFEFF/, '').replace(/<\?xml[\s\S]*?\?>/i, '').replace(/<!--[\s\S]*?-->/g, '')
  const root = /<resources\b([^>]*)>/.exec(s)
  if (!root) throw new Error('缺少 <resources> 根节点')
  const attrs = parseAttrs(root[1])
  const entries = {}
  const ignored = []
  let i = root.index + root[0].length

  while (i < s.length) {
    if (s.startsWith('</resources>', i)) break
    const lt = s.indexOf('<', i)
    if (lt < 0) throw new Error('<resources> 未闭合')
    if (lt > i && s.slice(i, lt).trim()) throw new Error('根节点内存在裸文本')
    // 标签之间允许换行/缩进：闭合 resources 前的空白不算裸文本
    if (s.startsWith('</resources>', lt)) break
    if (s.startsWith('<string', lt) && /^<string[\s>]/.test(s.slice(lt))) {
      const gt = s.indexOf('>', lt)
      if (gt < 0) throw new Error('<string> 标签未闭合')
      const name = parseAttrs(s.slice(lt, gt + 1)).name
      if (!name) throw new Error('<string> 缺少 name 属性')
      const { value, end } = readStringValue(s, gt + 1)
      entries[name] = value
      i = end
      continue
    }
    if (s.startsWith('</', lt)) throw new Error('非预期的闭合标签: ' + s.slice(lt, Math.min(lt + 30, s.length)))
    const gt = s.indexOf('>', lt)
    if (gt < 0) throw new Error('标签未闭合')
    const tagName = /^<([\w:-]+)/.exec(s.slice(lt, gt + 1))
    if (!tagName) throw new Error('非法标签')
    const close = s.indexOf('</' + tagName[1] + '>', gt)
    if (close < 0) throw new Error('标签未闭合: ' + tagName[1])
    ignored.push(tagName[1])
    i = close + tagName[1].length + 3
  }

  return {
    locale: typeof attrs.locale === 'string' ? attrs.locale : '',
    name: typeof attrs.name === 'string' ? attrs.name : '',
    fallback: typeof attrs.fallback === 'string' ? attrs.fallback : '',
    entries,
    ignored
  }
}

// 解析 *.lang.json。$ 前缀为元数据，其余键为词条。
export function parseJsonLangPack(text) {
  const obj = JSON.parse(String(text))
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON 根节点必须是对象')
  const entries = {}
  for (const [k, v] of Object.entries(obj)) if (!k.startsWith('$')) entries[k] = v
  return {
    locale: typeof obj.$locale === 'string' ? obj.$locale : '',
    name: typeof obj.$name === 'string' ? obj.$name : '',
    fallback: typeof obj.$fallback === 'string' ? obj.$fallback : '',
    entries,
    ignored: []
  }
}

// 按内置基准校验外部词条：未知 key / 空值 / 占位符不符一律丢弃并记 warning。
// 外部包永远不能扩充 key 空间 —— 门禁的 key 存在性检查依赖这一点。
export function validateEntries(entries, baseDict, label) {
  const accepted = {}
  const warnings = []
  for (const [key, value] of Object.entries(entries || {})) {
    if (!Object.prototype.hasOwnProperty.call(baseDict, key)) {
      warnings.push(`${label}: 未知 key「${key}」已忽略`)
      continue
    }
    if (typeof value !== 'string' || value.trim() === '') {
      warnings.push(`${label}: key「${key}」值为空或不是文本，已忽略`)
      continue
    }
    const expected = extractPlaceholders(baseDict[key])
    const actual = extractPlaceholders(value)
    const missing = [...expected].filter(x => !actual.has(x))
    const extra = [...actual].filter(x => !expected.has(x))
    if (missing.length || extra.length) {
      const detail = [missing.length ? '缺 ' + missing.map(x => '{' + x + '}').join(',') : '',
        extra.length ? '多 ' + extra.map(x => '{' + x + '}').join(',') : ''].filter(Boolean).join('；')
      warnings.push(`${label}: key「${key}」占位符不符（${detail}），已忽略`)
      continue
    }
    accepted[key] = value
  }
  return { accepted, warnings }
}
