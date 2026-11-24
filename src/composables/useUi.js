// 由 split_app2.cjs 自动拆分生成（ui）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t } from '@/i18n'
import {api, alwaysOnTop, toastMsg, toastShow} from './state'

function toast(msg) {
  toastMsg.value = msg
  toastShow.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastShow.value = false }, 1600)
}

function winMin() { api.send('window:minimize') }

function winMax() { api.send('window:toggleMax') }

function winClose() { api.send('window:close') }

// 置顶切换：主进程翻转窗口真实状态并返回结果，渲染层只同步状态 + 提示，
// 避免渲染层缓存值与窗口实际状态不一致（主进程是唯一事实来源）
async function winTop() {
  try {
    alwaysOnTop.value = !!(await api.invoke('window:toggleAlwaysOnTop'))
    toast(alwaysOnTop.value ? t('toast.topOn') : t('toast.topOff'))
  } catch { toast(t('toast.topFailed')) }
}

let toastTimer = null
export function useUi() {

  return { toast, winClose, winMax, winMin, winTop }
}
export { toast, winClose, winMax, winMin, winTop }