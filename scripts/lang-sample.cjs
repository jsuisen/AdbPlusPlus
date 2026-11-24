// 把 templates/lang/*.xml.sample 复制到工程根（= 开发态语言包扫描目录）。
// 用法：npm run lang:sample           列出可用样例
//       npm run lang:sample -- zh-TW  复制为中文繁体语言包
//       npm run lang:sample -- zh-TW --force  覆盖已存在文件
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sampleDir = path.join(root, 'templates', 'lang')
const args = process.argv.slice(2)
const force = args.includes('--force')
const name = args.find(a => !a.startsWith('--'))

if (!fs.existsSync(sampleDir)) {
  console.error('缺少目录:', sampleDir)
  process.exit(1)
}

const samples = fs.readdirSync(sampleDir)
  .filter(f => f.endsWith('.xml.sample'))
  .map(f => f.replace(/\.xml\.sample$/, ''))

if (!name || name === 'list') {
  console.log('可用语言包样例（存于 templates/lang/）：')
  for (const s of samples) console.log('  ' + s)
  console.log('\n根目录现成的示例：ja-JP.xml（改 lang 为 ja-JP 即可测试）')
  console.log('\n用法：npm run lang:sample -- <名称> [--force]')
  process.exit(0)
}

const id = name.replace(/\.xml$/, '')
const from = path.join(sampleDir, id + '.xml.sample')
if (!fs.existsSync(from)) {
  console.error('找不到样例:', id)
  console.error('可用:', samples.join(', ') || '(无)')
  process.exit(1)
}

const to = path.join(root, id + '.xml')
if (fs.existsSync(to) && !force) {
  console.error('目标已存在，未覆盖:', to)
  console.error('如需覆盖请加 --force')
  process.exit(1)
}

fs.copyFileSync(from, to)
const content = fs.readFileSync(to, 'utf8')
const locale = (/<resources[^>]*\blocale="([^"]+)"/.exec(content) || [])[1] || id
console.log('已复制:', path.relative(root, to))
console.log('该语言包的 locale =', locale)
console.log('测试方式：设置 → 语言包 → 界面语言，或把 adbtool-config.json 的 "lang" 改为 "' + locale + '" 后重启。')
