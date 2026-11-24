// 提交前静态验证管线：npm run check
// 覆盖历史上真实出现过的 bug 类别（漏导入/断链/拼写漂移/环/通道归类/模板隐式回退），全部基于仓内已有依赖（typescript 为传递依赖）。
// 1) tsc --checkJs：composables + shared 内的未定义名/重复定义/导出冲突（TS2304/2300/2308）
// 2) main/ 通道常量：使用但未导入 = 0；注册零字面量残留
// 3) 渲染侧 IPC 字面量 ⊆ 常量集；invoke/send/on 类别归属正确
// 4) composables 导入图无环
// 5) state barrel：state/*.js 导出名必须全部经 barrel 再导出且不重复
// 6) App.vue：模板标识符可解析 + 模板 ref 必须有同名 setup 绑定
// 7) 全部 .vue：模板布尔赋值（xxx = true/false）必须有 setup 绑定，防 _ctx 隐式回退
// 8) i18n：内置 locale key 集合一致 / t('字面量') key 存在 / 逻辑比较禁中文常量 / 裸中文清单(WARN) / 文案不入 IPC
import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'
import * as CH from '../shared/ipc-channels.js'

let fail = 0
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); if (!cond) fail++ }
const read = (p) => fs.readFileSync(p, 'utf8')
const walk = (dir) => fs.readdirSync(dir).flatMap(f => {
  const p = path.join(dir, f)
  return fs.statSync(p).isDirectory() ? walk(p) : (f.endsWith('.js') ? [p] : [])
})

// ---------- 1. tsc checkJs ----------
{
  const r = spawnSync(process.execPath, ['node_modules/typescript/lib/tsc.js', '--noEmit', '--allowJs', '--checkJs',
    '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--skipLibCheck',
    '--lib', 'es2022,dom', '--strict', 'false', 'src/composables', 'shared'], { encoding: 'utf8' })
  const errs = (r.stdout + r.stderr).split('\n').filter(l => /TS(2304|2300|2308)/.test(l))
  ok('tsc 未定义名/重复/导出冲突', errs.length === 0, errs.slice(0, 3).join(' | '))
}

// ---------- 2. main/ 通道常量 ----------
{
  const chSrc = read('shared/ipc-channels.js')
  const names = new Set([...chSrc.matchAll(/^export const ([A-Z0-9_]+) = '/gm)].map(m => m[1]))
  let miss = 0, literal = 0
  for (const f of fs.readdirSync('main').filter(x => x.endsWith('.js'))) {
    const src = read(path.join('main', f))
    const imported = new Set()
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*ipc-channels[^']*'/g)) m[1].split(',').forEach(n => imported.add(n.trim()))
    for (const m of src.matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g)) {
      if (names.has(m[1]) && !imported.has(m[1])) { console.log('  缺导入 ' + f + ': ' + m[1]); miss++ }
    }
    literal += (src.match(/ipcMain\.(handle|on)\('/g) || []).length
  }
  ok('main 通道常量导入完整', miss === 0)
  ok('main 注册零字面量残留', literal === 0, '残留 ' + literal)
}

// ---------- 3. 渲染侧 IPC 字面量 ⊆ 常量集 ----------
{
  const chSrc = read('shared/ipc-channels.js')
  const values = new Set([...chSrc.matchAll(/= '([^']+)'/gm)].map(m => m[1]))
  let unknown = []
  for (const f of walk('src')) {
    const src = read(f)
    for (const m of src.matchAll(/\b(?:api\.(?:invoke|send|on)|devInvoke\([^,]*,)\s*'([\w:-]+)'/g)) {
      if (!values.has(m[1])) unknown.push(path.relative('.', f) + ': ' + m[1])
    }
    for (const m of src.matchAll(/devInvoke\(([^,]+),\s*'([\w:-]+)'/g)) {
      if (!values.has(m[2])) unknown.push(path.relative('.', f) + ': ' + m[2])
    }
  }
  ok('渲染侧 IPC 字面量全部在常量集内', unknown.length === 0, unknown.slice(0, 3).join(' | '))

  // 类别归属：上面只查「字面量在不在常量全集里」，不查它属于 invoke/send/on 哪一类。
  // window:zoomIn 曾登记在 INVOKE 却被 api.send 调用，preload 白名单直接拒绝、整窗缩放静默失效。
  // 要求 api.xxx(' 紧邻；三元/变量形式的通道字面量扫不到，故调用侧一律写显式字面量。
  const sets = { invoke: CH.INVOKE_CHANNELS, send: CH.SEND_CHANNELS, on: CH.ON_CHANNELS }
  const wrong = []
  for (const f of walk('src')) {
    const src = read(f)
    for (const m of src.matchAll(/\bapi\.(invoke|send|on)\(\s*'([\w:-]+)'/g)) {
      if (!sets[m[1]].has(m[2])) wrong.push(path.relative('.', f) + ': api.' + m[1] + ' -> ' + m[2])
    }
  }
  ok('渲染侧 IPC 通道类别归属正确', wrong.length === 0, wrong.slice(0, 3).join(' | '))
}

// ---------- 4. composables 导入图无环 ----------
{
  const files = walk('src/composables')
  const graph = {}
  for (const f of files) {
    const src = read(f)
    const key = path.relative('src/composables', f).replace(/\\/g, '/')
    graph[key] = new Set()
    for (const m of src.matchAll(/(?:from|import)\s+'(\.[\w./-]+)'/g)) {
      const rel = path.relative('src/composables', path.normalize(path.join(path.dirname(f), m[1]))).replace(/\\/g, '/')
      if (rel !== key && files.includes(path.join('src/composables', rel))) graph[key].add(rel)
    }
  }
  const color = {}, stack = [], cycles = []
  const dfs = (n) => {
    color[n] = 1; stack.push(n)
    for (const m of graph[n] || []) {
      if (color[m] === 1) cycles.push([...stack.slice(stack.indexOf(m)), m].join(' -> '))
      else if (!color[m]) dfs(m)
    }
    stack.pop(); color[n] = 2
  }
  for (const f of Object.keys(graph)) if (!color[f]) dfs(f)
  ok('composables 导入图无环', cycles.length === 0, cycles[0] || '')
}

// ---------- 5. state barrel 覆盖完整 ----------
{
  const barrel = read('src/composables/state.js')
  const declared = new Map()
  for (const f of walk('src/composables/state')) {
    const src = read(f)
    const set = new Set()
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)) set.add(m[1])
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/gs)) for (let n of m[1].split(',')) { n = n.trim().split(/\s+as\s+/).pop(); if (n) set.add(n) }
    declared[path.basename(f)] = set
  }
  const missing = [], dup = new Map()
  for (const [f, set] of declared) for (const n of set) {
    if (dup.has(n)) missing.push(`${n} 重复于 ${f}/${dup.get(n)}`)
    else dup.set(n, f)
    if (!barrel.includes(n)) missing.push(`${n} (${f}) 未进 barrel`)
  }
  ok('state 域导出全部入 barrel 且无重名', missing.length === 0, missing.slice(0, 3).join(' | '))
}

// ---------- 6. App.vue 模板标识符与 ref 绑定 ----------
{
  const src = read('src/App.vue')
  const scriptEnd = src.indexOf('</script>')
  const script = src.slice(0, scriptEnd)
  const tmpl = src.slice(src.indexOf('<template>'))
  const defined = new Set(['true', 'false', 'null', 'undefined', 'Object', 'Math', 'Date', 'JSON', 'String', 'Number', 'Array'])
  for (const m of script.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*'/g)) m[1].split(',').forEach(n => defined.add(n.trim().split(/\s+as\s+/).pop().trim()))
  // 默认导入（如 v-html 用的 SVG ?raw 常量）也要登记，否则模板标识符扫描误报
  for (const m of script.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*'[^']*'/g)) defined.add(m[1])
  for (const m of script.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) m[1].split(',').forEach(n => defined.add(n.trim().split(':')[0].trim()))
  for (const m of script.matchAll(/\b(?:const|let|var)\s+(\w+)/g)) defined.add(m[1])
  for (const m of script.matchAll(/\bfunction\s+(\w+)/g)) defined.add(m[1])
  const loopVars = new Set()
  for (const m of tmpl.matchAll(/v-for="\(([^)]+)\)\s+(?:in|of)\s|v-for="([\w$]+)\s+(?:in|of)\s/g)) (m[1] || m[2] || '').split(',').forEach(n => loopVars.add(n.trim()))
  const problems = []
  const scan = (e) => {
    const clean = e.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, "''").replace(/`[^`]*`/g, '``')
    for (const m of clean.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (clean.slice(Math.max(0, m.index - 1), m.index) === '.') continue
      if (clean.slice(m.index + m[0].length).trimStart().startsWith(':')) continue
      if (!defined.has(m[0]) && !loopVars.has(m[0]) && !['$event', 'true', 'false', 'null', 'undefined', 'in', 'of', 'new', 'typeof'].includes(m[0])) problems.push(m[0] + ' @ ' + e.trim().slice(0, 40))
    }
  }
  for (const m of tmpl.matchAll(/\{\{([\s\S]*?)\}\}/g)) scan(m[1])
  for (const m of tmpl.matchAll(/(?:@[\w.:\[\]-]+|:[\w.:\[\]-]+|v-[\w:.\[\]-]+)="([^"]*)"/g)) scan(m[1])
  const refBad = []
  for (const m of tmpl.matchAll(/\bref="([\w$]+)"/g)) if (!defined.has(m[1])) refBad.push(m[1])
  ok('App.vue 模板标识符全部可解析', problems.length === 0, [...new Set(problems)].slice(0, 3).join(' | '))
  ok('App.vue 模板 ref 均有同名绑定', refBad.length === 0, refBad.join(','))

  // 窄规则：只查「xxx = true/false」这类模板赋值，不扩全量标识符扫描
  // （defineModel / props 的读取会被全量扫描误报）。
  // <script setup> 里没有同名绑定时，Vue 编译成 _ctx.xxx = true，写到组件实例 ctx
  // 而非 state ref —— KeyModal 的「速查」按钮曾因此完全失效。
  const walkVue = (dir) => fs.readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f)
    return fs.statSync(p).isDirectory() ? walkVue(p) : (f.endsWith('.vue') ? [p] : [])
  })
  const assignBad = []
  for (const f of walkVue('src')) {
    const src = read(f)
    const se = src.indexOf('</script>')
    if (se < 0) continue
    const script = src.slice(0, se)
    const tmpl = src.slice(src.indexOf('<template>'))
    const bound = new Set()
    for (const m of script.matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*'/g)) m[1].split(',').forEach(n => bound.add(n.trim().split(/\s+as\s+/).pop().trim()))
    for (const m of script.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s*'[^']*'/g)) bound.add(m[1])
    for (const m of script.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) m[1].split(',').forEach(n => bound.add(n.trim().split(':')[0].trim()))
    for (const m of script.matchAll(/\b(?:const|let|var)\s+(\w+)/g)) bound.add(m[1])
    for (const m of script.matchAll(/\bfunction\s+(\w+)/g)) bound.add(m[1])
    // 前缀排除成员赋值：ctxMenu.visible = false 里的 visible 不是裸标识符，不该报
    for (const m of tmpl.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=\s*(?:true|false)\b/g)) {
      if (!bound.has(m[1])) assignBad.push(path.relative('.', f) + ': ' + m[1])
    }
  }
  ok('组件模板布尔赋值均有 setup 绑定', assignBad.length === 0, [...new Set(assignBad)].slice(0, 3).join(' | '))
}

// ---------- 8. i18n 门禁 ----------
{
  const { flatten } = await import('../shared/i18n/translate.js')
  const zh = flatten((await import('../shared/i18n/locales/zh-CN.js')).default)
  const keycodeZh = flatten((await import('../shared/i18n/locales/keycode.zh-CN.js')).default)
  const base = { ...zh }
  for (const [k, v] of Object.entries(keycodeZh)) base['keycode.' + k] = v

  // 8.1 内置 locale key 集合必须与基准完全一致（外部语言包不进 CI，运行期校验）
  const keyProblems = []
  for (const id of ['zh-CN', 'en-US']) {
    const main = flatten((await import(`../shared/i18n/locales/${id}.js`)).default)
    const kc = flatten((await import(`../shared/i18n/locales/keycode.${id}.js`)).default)
    const keys = new Set([...Object.keys(main), ...Object.keys(kc).map(k => 'keycode.' + k)])
    const miss = Object.keys(base).filter(k => !keys.has(k))
    const extra = [...keys].filter(k => !Object.prototype.hasOwnProperty.call(base, k))
    if (miss.length || extra.length) {
      keyProblems.push(`${id}: 缺[${miss.slice(0, 3).join(',')}] 多[${extra.slice(0, 3).join(',')}]`)
    }
  }
  ok('i18n 内置 locale key 集合一致', keyProblems.length === 0, keyProblems.join(' | '))

  // 8.2 t('字面量') 的 key 必须存在。只查含点号的形态，避免误伤其它模块里同名的 t() 局部变量。
  const badKeys = []
  const i18nFiles = [...walk('src'), ...walk('main')]
  for (const f of i18nFiles) {
    const src = read(f)
    for (const m of src.matchAll(/\b(?:t|mt)\(\s*'([^']+)'/g)) {
      const k = m[1]
      if (/^[a-z][\w-]*(?:\.[\w-]+)+$/.test(k) && !Object.prototype.hasOwnProperty.call(base, k)) {
        badKeys.push(path.relative('.', f) + ': ' + k)
      }
    }
  }
  ok('i18n t() 字面量 key 均存在', badKeys.length === 0, badKeys.slice(0, 3).join(' | '))

  // 8.3 逻辑比较禁止中文常量（中文哨兵切语言后会静默失效）
  const chineseCmp = []
  for (const f of i18nFiles) {
    const src = read(f)
    for (const m of src.matchAll(/={2,3}\s*'[^']*[\u4e00-\u9fff][^']*'/g)) {
      chineseCmp.push(path.relative('.', f) + ': ' + m[0].trim())
    }
  }
  ok('i18n 逻辑比较无中文常量', chineseCmp.length === 0, chineseCmp.slice(0, 3).join(' | '))

  // 8.4 裸中文残留清单（WARN，不阻断；P1~P5 逐批清零）
  const bare = []
  const skipFiles = /[\\/](locales|i18n|state\/actions\.js)[\\/]/
  const vueFiles = fs.readdirSync('src').flatMap(f => {
    const p = path.join('src', f)
    return fs.statSync(p).isDirectory()
      ? (function walkVue(d) { return fs.readdirSync(d).flatMap(x => {
          const q = path.join(d, x)
          return fs.statSync(q).isDirectory() ? walkVue(q) : (x.endsWith('.vue') ? [q] : [])
        }) })(p)
      : (f.endsWith('.vue') ? [p] : [])
  })
  for (const f of vueFiles) {
    if (skipFiles.test(f)) continue
    const src = read(f)
    const all = src.slice(src.indexOf('<template>'))
    const styleAt = all.indexOf('<style')   // 样式段里的中文注释不是 UI 文案
    const tmpl = (styleAt < 0 ? all : all.slice(0, styleAt))
      .replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, '')
    for (const m of tmpl.matchAll(/>(\s*[^<>]*[\u4e00-\u9fff][^<>]*\s*)</g)) {
      const text = m[1].trim()
      if (text) bare.push(path.relative('.', f) + ': ' + text.slice(0, 30))
    }
  }
  if (bare.length) console.log(`WARN i18n 模板裸中文 ${bare.length} 处（P1~P5 逐批迁移）: ${bare.slice(0, 6).join(' | ')}`)
  else console.log('PASS i18n 模板无裸中文')

  // 8.5 文案不得进 IPC 参数：外部语言包能改文案，必须守住文案不参与命令拼接
  const textInIpc = []
  for (const f of i18nFiles) {
    const src = read(f)
    for (const m of src.matchAll(/\bapi\.(?:invoke|send)\(\s*(?:t|mt)\s*\(/g)) textInIpc.push(path.relative('.', f))
    for (const m of src.matchAll(/\bdevInvoke\([^,]+,\s*(?:t|mt)\s*\(/g)) textInIpc.push(path.relative('.', f))
  }
  ok('i18n 文案未进入 IPC 参数', textInIpc.length === 0, [...new Set(textInIpc)].slice(0, 3).join(' | '))

  // 8.6 i18n 专有 API 使用处必须有 import（tsc checkJs 因 @ alias 无法解析会漏报，补显式断言）
  const missingImport = []
  const allVue = []
  ;(function walkVue(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) walkVue(p)
      else if (f.endsWith('.vue')) allVue.push(p)
    }
  })('src')
  for (const f of [...i18nFiles, ...allVue]) {
    const src = read(f)
    const usage = src.replace(/export\s+function\s+tKeycode\s*\(/, '')   // 排除定义处本身
    if (!/\btKeycode\s*\(/.test(usage)) continue
    if (!/import\s*\{[^}]*\btKeycode\b[^}]*\}\s*from\s*'[^']*i18n'/.test(src)) missingImport.push(path.relative('.', f))
  }
  ok('i18n tKeycode 使用处均已导入', missingImport.length === 0, [...new Set(missingImport)].slice(0, 3).join(' | '))

  // 8.7 脚本段中文字符串：模板门禁只扫 <template>，曾漏掉 SettingsModal 的「Tag 过滤历史」等。
  // 白名单仅放行：迁移用的 LEGACY_DEFAULT_GROUP、注释、throw 与 console。
  const scriptChinese = []
  const allowChinese = new Set(['默认', '简体中文', '参数', '数值'])  // 迁移常量 / 语言显示名 / throw 参数标签
  const scanScript = (raw, label) => {
    const src = raw.replace(/<!--[\s\S]*?-->/g, '')   // 导出的 XML 模板注释（可能跨行）
    src.split('\n').forEach((line, i) => {
      const code = line.split('//')[0]      // 去掉行尾注释
      if (/<!--|throw new Error|console\./.test(code)) return  // 导出 XML 模板里的注释不是 UI 文案
      for (const m of code.matchAll(/'([^']*[\u4e00-\u9fff][^']*)'/g)) {
        if (allowChinese.has(m[1])) continue
        scriptChinese.push(`${label}:${i + 1}: ${m[1].slice(0, 30)}`)
      }
    })
  }
  for (const f of allVue) {
    const src = read(f)
    const end = src.indexOf('</script>')
    if (end >= 0) scanScript(src.slice(src.indexOf('<script'), end), path.relative('.', f))
  }
  // main/ 的中文按设计分三类（用户可见已逐条接入 mt / 参数校验 throw / console），不能一刀切扫描
  for (const f of walk('src')) scanScript(read(f), path.relative('.', f))
  const filteredScriptChinese = scriptChinese.filter(x =>
    !x.includes('语言包加载失败') && !x.includes('配置保存失败') && !x.includes('解析失败') && !x.includes('迁移'))
  ok('i18n 脚本段无裸中文', filteredScriptChinese.length === 0, filteredScriptChinese.slice(0, 3).join(' | '))

  // 8.8 内嵌语言包样例：词条 key 与占位符必须合法，否则用户测试时会被静默丢弃
  {
    const { parseXmlLangPack, parseJsonLangPack, validateEntries } = await import('../shared/i18n/langpack.js')
    const problems = []
    const candidates = []
    if (fs.existsSync('templates/lang')) {
      for (const f of fs.readdirSync('templates/lang')) {
        if (/\.xml(\.sample)?$|\.lang\.json(\.sample)?$/.test(f)) candidates.push(path.join('templates/lang', f))
      }
    }
    // 工程根的全部内嵌语言包（dev 语言包扫描目录）
    for (const f of fs.readdirSync('.')) {
      if (/\.xml$|\.lang\.json$/.test(f) && fs.statSync(f).isFile()) candidates.push(f)
    }
    for (const f of candidates) {
      try {
        const text = read(f)
        const p = /\.json/.test(f) ? parseJsonLangPack(text) : parseXmlLangPack(text)
        if (!p.locale) { problems.push(`${f}: locale 为空`); continue }
        const v = validateEntries(p.entries, base, f)
        if (v.warnings.length) problems.push(`${f}: ${v.warnings[0]}`)
      } catch (e) { problems.push(`${f}: ${e.message}`) }
    }
    ok('i18n 内嵌语言包样例词条合法', problems.length === 0, problems.slice(0, 3).join(' | '))
  }

  // 8.9 系统语言探测：zh* → zh-CN，其余 → en-US（lang 留空时生效）
  {
    const { localeFromSystem } = await import('../main/i18n.js')
    const cases = [['zh-CN', 'zh-CN'], ['zh-TW', 'zh-CN'], ['en-US', 'en-US'], ['ja-JP', 'en-US'], ['', 'en-US']]
    const bad = cases.filter(([loc, expect]) => localeFromSystem(loc) !== expect).map(([loc]) => loc)
    ok('i18n 系统语言探测规则', bad.length === 0, bad.join(' | '))
  }
}

console.log(fail === 0 ? 'CHECK-OK 全部通过' : `CHECK-FAIL ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
