// 版本检测：主进程内异步执行，不阻塞启动。
// 数据源：主用 GitHub Releases「最新版」接口（需发 Release）；失败回退读仓库默认分支的 package.json 版本号。
// 版本号以 package.json 的 semver 为单一事实来源（app.getVersion() 读取）。
import { app } from 'electron'
import { RELEASES_API, RAW_PKG_URL, REPO_URL, normalizeTag, normalizeVersion, compareVersions } from '../shared/version.js'

// 取远程最新版本信息：优先 releases/latest（含发布说明与下载页），失败回退 raw package.json
async function fetchRemoteVersion() {
  // 主路径：releases/latest
  try {
    const r = await fetch(RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'AdbPlusPlus' },
      signal: AbortSignal.timeout(8000)
    })
    if (r.ok) {
      const j = await r.json()
      return {
        version: normalizeTag(j.tag_name),
        url: j.html_url || REPO_URL,
        notes: j.body || '',
        source: 'release'
      }
    }
  } catch { /* 回退路径 */ }

  // 回退：读默认分支 package.json 的 version 字段
  const r2 = await fetch(RAW_PKG_URL, { signal: AbortSignal.timeout(8000) })
  if (!r2.ok) throw new Error('无法获取远程版本信息')
  const j2 = await r2.json()
  const ver = normalizeVersion(j2.version)
  if (!ver) throw new Error('远程版本号解析失败')
  return { version: ver, url: REPO_URL + '/releases', notes: '', source: 'raw' }
}

// 检测是否有新版本：返回当前/远程版本与是否可升级
export async function checkForUpdates() {
  const current = app.getVersion()
  const remote = await fetchRemoteVersion()
  return {
    current,
    latest: remote.version,
    hasUpdate: compareVersions(remote.version, current) > 0,
    url: remote.url,
    notes: remote.notes,
    source: remote.source
  }
}
