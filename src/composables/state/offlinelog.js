// 共享状态：离线日志（设备端 nohup logcat 会话 / 文件列表 / 管理弹窗）
import { ref, reactive } from 'vue'

// serial -> 是否离线日志采集中
export const offlineLogCapturing = reactive({})

// serial -> [{name,size,mtime,path}]
export const offlineLogList = reactive({})

export const offlineLogOpen = ref(false)

// 手动导出/采集过滤用的 PID（空 = 全部进程）
export const offlineLogPid = ref('')
