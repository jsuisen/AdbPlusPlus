// 由 split_app2.cjs 自动拆分生成（ui）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {api, toastMsg, toastShow} from './state'

function toast(msg) {
  toastMsg.value = msg
  toastShow.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastShow.value = false }, 1600)
}

function winMin() { api.send('window:minimize') }

function winMax() { api.send('window:toggleMax') }

function winClose() { api.send('window:close') }

let toastTimer = null
export function useUi() {

  return { toast, winClose, winMax, winMin }
}
export { toast, winClose, winMax, winMin }