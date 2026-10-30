// 版本检测共享常量与纯函数：开源工程地址、GitHub 数据源构造、semver 比较、本地日期。
// 主进程（版本检测）与渲染进程（关于弹窗 / 升级对话框）共用，保证单一事实来源。

// 开源工程地址：关于弹窗展示、升级对话框「复制地址」均以此为准
export const REPO_URL = 'https://github.com/jsuisen/AdbPlusPlus'
const REPO = 'jsuisen/AdbPlusPlus'

// 主用数据源：GitHub Releases「最新版」接口，返回 tag_name / html_url / body（发布说明）
export const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`
// 回退数据源：直接读仓库默认分支的 package.json（无需发 Release，只要提交了带新版本号的 package.json）
export const RAW_PKG_URL = `https://raw.githubusercontent.com/${REPO}/main/package.json`

// 去掉版本号前的 v 前缀（GitHub tag 常写作 v1.2.3）
export function normalizeTag(tag) {
  if (typeof tag !== 'string') return ''
  return tag.trim().replace(/^v/i, '')
}

// 解析远程 package.json 里的 version 字段（已是纯 semver，无需去 v）
export function normalizeVersion(v) {
  if (typeof v !== 'string') return ''
  return v.trim()
}

// 零依赖 semver 比较：a > b 返回 1，a < b 返回 -1，相等返回 0。
// 仅比较 主.次.修订 三段数字，缺失段按 0 处理；非数字段忽略。
export function compareVersions(a, b) {
  const pa = String(a || '').split('.').map(s => parseInt(s, 10) || 0)
  const pb = String(b || '').split('.').map(s => parseInt(s, 10) || 0)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

// 本地日期 YYYY-MM-DD，用于「本日不再提醒」判断
export function todayStr() {
  const d = new Date()
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
