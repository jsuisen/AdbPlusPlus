// 共享状态：全局 UI 开关（弹窗面板）
import { ref } from 'vue'

export const aboutOpen = ref(false)

export const settingsOpen = ref(false)

export const updateOpen = ref(false)

export const settingsTab = ref('colors')
