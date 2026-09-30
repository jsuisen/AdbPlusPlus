// 共享状态单例：按域拆分到 ./state/*，本文件聚合导出，保持 `import ... from './state'` 既有路径兼容。
// 域划分：core（api/配置/全局消息）· ui（面板开关）· devices（设备连接）· logcat（日志采集与查找）
//        · logstyle（日志外观）· actions（快捷操作）· deviceinfo（设备信息检测）· media（媒体抓包）· apk
// shared.js 是无状态纯函数层，一并聚合导出（历史导入路径 pad2/ymd 等来自 state）。
export * from './state/core.js'
export * from './state/ui.js'
export * from './state/devices.js'
export * from './state/logcat.js'
export * from './state/logstyle.js'
export * from './state/actions.js'
export * from './state/deviceinfo.js'
export * from './state/media.js'
export * from './state/apk.js'
export * from './shared.js'
