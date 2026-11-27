<script setup>
// 离线日志管理弹窗：设备端 nohup logcat 后台落盘文件列表 + 下载 / 复制路径 / 删除 / 当前缓冲导出
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import {
  startOfflineLog, stopOfflineLog, refreshOfflineLogs, pullOfflineLog,
  copyOfflineLogPath, deleteOfflineLog, dumpOfflineLog
} from '@/composables/useOfflineLog'
import { t } from '@/i18n'

const { offlineLogOpen, offlineLogCapturing, offlineLogList, offlineLogPid, cfg, selectedSerial } = State
</script>

<template>
  <div v-if="offlineLogOpen" class="modal-mask" @click.self="maskClose(() => offlineLogOpen = false)">
    <div class="modal capture-modal">
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
      </div>
      <div class="modal-foot"><button class="primary" @click="offlineLogOpen = false">{{ t('common.close') }}</button></div>
    </div>
  </div>
</template>

<style scoped>
.offline-pid { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.offline-pid input { width: 110px; }
</style>
