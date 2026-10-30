<script setup>
// 抓包管理弹窗：设备端 pcap 列表 + 下载 / 复制路径 / 删除
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { startCapture, stopCapture, refreshCaptures, pullCapture, copyCapturePath, deleteCapture } from '@/composables/useMedia'

const { captureOpen, capturing, captureList, cfg, selectedSerial } = State
</script>

<template>
  <div v-if="captureOpen" class="modal-mask" @click.self="maskClose(() => captureOpen = false)">
    <div class="modal capture-modal">
      <div class="modal-head">抓包管理（{{ selectedSerial }}）<button class="modal-x" @click="captureOpen = false">×</button></div>
      <div class="modal-body capture-body">
        <div class="capture-actions">
          <button v-if="!capturing[selectedSerial]" class="primary" @click="startCapture">开始抓包</button>
          <button v-else class="primary" @click="stopCapture">停止抓包</button>
          <button @click="refreshCaptures">刷新列表</button>
        </div>
        <div v-if="!(captureList[selectedSerial] && captureList[selectedSerial].length)" class="muted small">该设备暂无抓包文件（目录：{{ cfg.captureDeviceDir }}）。</div>
        <table v-else class="capture-table">
          <thead><tr><th>文件名</th><th>大小</th><th>时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="it in captureList[selectedSerial]" :key="it.path">
              <td class="cap-name" :title="it.path">{{ it.name }}</td>
              <td>{{ it.size }}</td>
              <td>{{ it.mtime }}</td>
              <td class="cap-ops">
                <button @click="pullCapture(it)">下载</button>
                <button @click="copyCapturePath(it)">复制路径</button>
                <button class="danger" @click="deleteCapture(it)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-foot"><button class="primary" @click="captureOpen = false">关闭</button></div>
    </div>
  </div>
</template>
