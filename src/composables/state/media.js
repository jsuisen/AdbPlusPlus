// 共享状态：媒体与抓包（录屏 / 截图 / 网络抓包会话）
import { ref, reactive } from 'vue'

export const recording = ref(false)

export const screenshotting = ref(false)

// serial -> 是否抓包中
export const capturing = reactive({})

// serial -> [{name,size,mtime,path}]
export const captureList = reactive({})

export const captureOpen = ref(false)
