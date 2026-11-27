// 共享状态：离线日志（设备端 nohup logcat 会话 / 文件列表 / 管理弹窗）
import { ref, reactive } from 'vue'

// serial -> 是否离线日志采集中
export const offlineLogCapturing = reactive({})

// serial -> [{name,size,mtime,path}]
export const offlineLogList = reactive({})

export const offlineLogOpen = ref(false)

// 手动导出/采集过滤用的 PID（空 = 全部进程）
export const offlineLogPid = ref('')

// 下载进行中：弹窗置灰，阻止重复点击 / 关闭
export const offlineLogBusy = ref(false)

// 最近一次下载到本机的完整路径（显示在弹窗下方，点击可复制）
export const offlineLogLastDownload = ref('')
