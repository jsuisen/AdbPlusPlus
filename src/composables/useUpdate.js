// 版本升级检测（渲染层逻辑）：订阅主进程推送、手动触发、打开/关闭升级对话框、本日忽略。
// 遵循工程约定：渲染进程只经 window.api 与主进程通信；状态集中在 state/*。
import { api, cfg, updateInfo, updateOpen } from './state'
import { toast } from './useUi'
import { REPO_URL, todayStr } from '@shared/version.js'

// 主进程推送「有更新」时调用：始终记录升级信息（状态栏徽标展示），仅在「本日未忽略」时弹对话框
function onUpdateAvailable(payload) {
  if (!payload || !payload.hasUpdate) return
  updateInfo.value = payload
  if (isDismissedToday()) return
  openUpdateDialog(payload)
}

// 本日是否已「取消提醒」
function isDismissedToday() {
  return typeof cfg.value.updateDismissedDate === 'string' && cfg.value.updateDismissedDate === todayStr()
}

// 打开「是否版本升级」对话框
function openUpdateDialog(payload) {
  if (payload) updateInfo.value = payload
  updateOpen.value = true
}

// 仅关闭对话框，不记录本日忽略（点击遮罩等非显式取消场景用）
function closeDialog() {
  updateOpen.value = false
}

// 显式「取消」：记下今天日期，关闭对话框（状态栏徽标仍保留，仅本日不再弹窗）
function dismissToday() {
  cfg.value.updateDismissedDate = todayStr()
  updateOpen.value = false
  // 持久化本日忽略设置
  api.invoke('config:save', JSON.parse(JSON.stringify(cfg.value))).catch(() => {})
}

// 关于弹窗「版本检测」按钮：主动查询，不受本日忽略限制
async function manualCheck() {
  try {
    const res = await api.invoke('app:checkUpdate')
    if (res && res.error) { toast('版本检测失败：' + res.error); return }
    if (res && res.hasUpdate) {
      updateInfo.value = res
      openUpdateDialog(res)
    } else {
      toast('已是最新版本 v' + (res ? res.current : ''))
    }
  } catch (e) {
    toast('版本检测失败：' + e.message)
  }
}

// 复制开源工程地址到剪贴板（复用已有 clipboard:write 通道，不自动打开浏览器）
async function copyRepoUrl() {
  try {
    await api.invoke('clipboard:write', { text: REPO_URL })
    toast('已复制开源工程地址，请在浏览器打开')
  } catch {
    toast('复制失败')
  }
}

export function useUpdate() {
  return { onUpdateAvailable, openUpdateDialog, closeDialog, dismissToday, manualCheck, copyRepoUrl, isDismissedToday }
}
export { onUpdateAvailable, openUpdateDialog, closeDialog, dismissToday, manualCheck, copyRepoUrl, isDismissedToday }
