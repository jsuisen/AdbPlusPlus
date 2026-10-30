// 提交前静态验证管线：npm run check
// 覆盖历史上真实出现过的 bug 类别（漏导入/断链/拼写漂移/环），全部基于仓内已有依赖（typescript 为传递依赖）。
// 1) tsc --checkJs：composables + shared 内的未定义名/重复定义/导出冲突（TS2304/2300/2308）
// 2) main/ 通道常量：使用但未导入 = 0；注册零字面量残留
// 3) 渲染侧 IPC 字面量 ⊆ shared/ipc-channels.js 常量集（拼写漂移防护）
// 4) composables 导入图无环
// 5) state barrel：state/*.js 导出名必须全部经 barrel 再导出且不重复
// 6) App.vue：模板标识符可解析 + 模板 ref 必须有同名 setup 绑定
import fs from 'node:fs'
import path from 'node:path'
import { execSync, spawnSync } from 'node:child_process'

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
}

console.log(fail === 0 ? 'CHECK-OK 全部通过' : `CHECK-FAIL ${fail} 项`)
process.exit(fail === 0 ? 0 : 1)
