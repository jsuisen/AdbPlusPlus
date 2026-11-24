// i18n 纯函数：字典扁平化 / 插值 / 占位符提取 / 翻译器工厂。
// 主进程与渲染进程共用，不依赖 Node 与 Vue。

// 嵌套对象 → 扁平字典（'app.title'）。已是扁平 key 的对象原样保留。
// 注意：值必须是字符串，非字符串节点（如数组）会被忽略并跳过，避免误把配置当词条。
export function flatten(src, prefix = '', out = {}) {
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out
  for (const [k, v] of Object.entries(src)) {
    const key = prefix ? prefix + '.' + k : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else if (typeof v === 'string') out[key] = v
  }
  return out
}

// 提取 {name} 形式的占位符集合。用于外部语言包校验：值的占位符必须与内置一致。
export function extractPlaceholders(text) {
  const out = new Set()
  if (typeof text !== 'string') return out
  for (const m of text.matchAll(/\{(\w+)\}/g)) out.add(m[1])
  return out
}

// 插值：{name} → params.name；缺失参数保留原文（不抛错，便于定位漏传）。
export function interpolate(text, params) {
  if (typeof text !== 'string') return String(text ?? '')
  if (!params || typeof params !== 'object') return text
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  )
}

// 翻译器工厂。dict 为已合并的当前语言字典，fallback 为回退字典。
// onMissing(key) 用于开发期告警；返回顺序：当前 → 回退 → key 原文。
export function createTranslator(dict, fallback, onMissing) {
  return function translate(key, params) {
    const cur = dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : undefined
    if (cur !== undefined) return interpolate(cur, params)
    const fb = fallback && Object.prototype.hasOwnProperty.call(fallback, key) ? fallback[key] : undefined
    if (fb !== undefined) return interpolate(fb, params)
    if (typeof onMissing === 'function') onMissing(key)
    return key
  }
}
