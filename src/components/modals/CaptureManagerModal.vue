<script setup>
// 抓包管理弹窗：设备端 pcap 列表 + 下载 / 复制路径 / 删除
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { startCapture, stopCapture, refreshCaptures, pullCapture, copyCapturePath, deleteCapture } from '@/composables/useMedia'
import { t } from '@/i18n'

const { captureOpen, capturing, captureList, cfg, selectedSerial } = State
</script>

<template>
  <div v-if="captureOpen" class="modal-mask" @click.self="maskClose(() => captureOpen = false)">
    <div class="modal capture-modal">
      <div class="modal-head">{{ t('capture.title', { s: selectedSerial }) }}<button class="modal-x" @click="captureOpen = false">×</button></div>
      <div class="modal-body capture-body">
        <div class="capture-actions">
          <button v-if="!capturing[selectedSerial]" class="primary" @click="startCapture">{{ t('action.captureToggle') }}</button>
          <button v-else class="primary" @click="stopCapture">{{ t('capture.stop') }}</button>
          <button @click="refreshCaptures">{{ t('common.refreshList') }}</button>
        </div>
        <div v-if="!(captureList[selectedSerial] && captureList[selectedSerial].length)" class="muted small">{{ t('capture.noFilesFull', { dir: cfg.captureDeviceDir }) }}</div>
        <table v-else class="capture-table">
          <thead><tr><th>{{ t('capture.filename') }}</th><th>{{ t('capture.size') }}</th><th>{{ t('capture.time') }}</th><th>{{ t('common.operation') }}</th></tr></thead>
          <tbody>
            <tr v-for="it in captureList[selectedSerial]" :key="it.path">
              <td class="cap-name" :title="it.path">{{ it.name }}</td>
              <td>{{ it.size }}</td>
              <td>{{ it.mtime }}</td>
              <td class="cap-ops">
                <button @click="pullCapture(it)">{{ t('common.download') }}</button>
                <button @click="copyCapturePath(it)">{{ t('common.copyPath') }}</button>
                <button class="danger" @click="deleteCapture(it)">{{ t('common.delete') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-foot"><button class="primary" @click="captureOpen = false">{{ t('common.close') }}</button></div>
    </div>
  </div>
</template>
