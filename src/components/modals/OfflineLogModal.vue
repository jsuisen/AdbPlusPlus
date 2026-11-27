<script setup>
// 离线日志管理弹窗：设备端 nohup logcat 后台落盘文件列表 + 下载 / 复制路径 / 删除 / 当前缓冲导出
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import {
  startOfflineLog, stopOfflineLog, refreshOfflineLogs, pullOfflineLog,
  copyOfflineLogPath, copyDownloadPath, deleteOfflineLog, dumpOfflineLog
} from '@/composables/useOfflineLog'
import { t } from '@/i18n'

const { offlineLogOpen, offlineLogBusy, offlineLogCapturing, offlineLogLastDownload, offlineLogList, offlineLogPid, cfg, selectedSerial } = State
</script>

<template>
  <div v-if="offlineLogOpen" class="modal-mask" @click.self="maskClose(() => { if (!offlineLogBusy) offlineLogOpen = false })">
    <div class="modal capture-modal offline-log-modal">
      <div class="modal-head">{{ t('offlinelog.title', { s: selectedSerial }) }}<button class="modal-x" @click="offlineLogOpen = false">×</button></div>
      <div class="modal-body capture-body">
        <div class="capture-actions">
          <button v-if="!offlineLogCapturing[selectedSerial]" class="primary" @click="startOfflineLog">{{ t('offlinelog.start') }}</button>
          <button v-else class="primary" @click="stopOfflineLog">{{ t('offlinelog.stop') }}</button>
          <button @click="refreshOfflineLogs">{{ t('common.refreshList') }}</button>
          <button @click="dumpOfflineLog">{{ t('offlinelog.dump') }}</button>
          <label class="offline-pid">{{ t('offlinelog.pid') }}
            <input v-model="offlineLogPid" :placeholder="t('offlinelog.pidPlaceholder')" spellcheck="false" />
          </label>
        </div>
        <p class="muted small">{{ t('offlinelog.hint', { dir: cfg.offlineLogDeviceDir }) }}</p>
        <div v-if="!(offlineLogList[selectedSerial] && offlineLogList[selectedSerial].length)" class="muted small">{{ t('offlinelog.noFilesFull', { dir: cfg.offlineLogDeviceDir }) }}</div>
        <table v-else class="capture-table">
          <thead><tr><th>{{ t('capture.filename') }}</th><th>{{ t('capture.size') }}</th><th>{{ t('capture.time') }}</th><th>{{ t('common.operation') }}</th></tr></thead>
          <tbody>
            <tr v-for="it in offlineLogList[selectedSerial]" :key="it.path">
              <td class="cap-name" :title="it.path">{{ it.name }}</td>
              <td>{{ it.size }}</td>
              <td>{{ it.mtime }}</td>
              <td class="cap-ops">
                <button @click="pullOfflineLog(it)">{{ t('common.download') }}</button>
                <button @click="copyOfflineLogPath(it)">{{ t('common.copyPath') }}</button>
                <button class="danger" @click="deleteOfflineLog(it)">{{ t('common.delete') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="offlineLogLastDownload" class="offline-download-path" :title="t('offlinelog.copyPathHint')" @click="copyDownloadPath">{{ offlineLogLastDownload }}</div>
      </div>
      <div class="modal-foot"><button class="primary" @click="offlineLogOpen = false">{{ t('common.close') }}</button></div>
      <div v-if="offlineLogBusy" class="offline-download-mask">
        <div class="busy-spinner"></div>
        <span>{{ t('offlinelog.downloading') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.offline-log-modal { position: relative; }
.offline-pid { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.offline-pid input { width: 110px; }
.offline-download-mask { position: absolute; inset: 0; z-index: 10; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(255,255,255,.68); border-radius: 8px; color: var(--muted); font-size: 13px; cursor: not-allowed; }
.offline-download-path { margin-top: 10px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 6px; background: #f7f8fa; color: #185FA5; font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; line-height: 1.5; word-break: break-all; user-select: text; cursor: pointer; }
</style>
