// 主题应用：三态解析 + documentElement dataset + 系统主题跟随 + 主进程 nativeTheme 同步。
// 主题属性必须挂 html：右键菜单与查找窗 Teleport 到 body，只有 html 上的选择器能覆盖到它们。
import { api } from './state'
import { WINDOW_SET_THEME } from '@shared/ipc-channels.js'

let mql = null
let sysChangeHandler = null
const listeners = new Set()

// 订阅「实际生效的主题」：system 态跟随系统变化时也会通知，供日志默认色同步。
export function onThemeResolved(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function normalize(mode) {
  return (mode === 'light' || mode === 'dark') ? mode : 'system'
}

function resolved(mode) {
  if (mode === 'light' || mode === 'dark') return mode
  return (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
}

function paint(mode) {
  const r = resolved(mode)
  document.documentElement.dataset.theme = r
  for (const fn of listeners) fn(r)
}

// 供启动与设置面板共用：mode 为 'light' | 'dark' | 'system'，非法值按 system 处理。
export function applyTheme(mode) {
  const m = normalize(mode)
  paint(m)
  if (mql && sysChangeHandler) {
    mql.removeEventListener('change', sysChangeHandler)
    mql = null
    sysChangeHandler = null
  }
  if (m === 'system' && typeof window.matchMedia === 'function') {
    mql = window.matchMedia('(prefers-color-scheme: dark)')
    sysChangeHandler = () => paint('system')
    mql.addEventListener('change', sysChangeHandler)
  }
  // 失败不影响应用内主题；主进程只服务原生对话框，缺失时降级为纯 CSS 主题。
  api.invoke(WINDOW_SET_THEME, m).catch(() => {})
}

export function useTheme() {
  return { applyTheme, onThemeResolved }
}
