<script setup>
// 文件推送/拉取弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { choosePushFile, runFile } from '@/composables/useActions'

const { fileModalOpen, fileModalMode, fileLocal, fileRemote } = State
</script>

<template>
  <div v-if="fileModalOpen" class="modal-mask" @click.self="maskClose(() => fileModalOpen = false)">
    <div class="modal">
      <div class="modal-head">{{ fileModalMode === 'push' ? '推送文件（电脑→设备）' : '拉取文件（设备→电脑）' }}<button class="modal-x" @click="fileModalOpen = false">×</button></div>
      <div class="modal-body">
        <template v-if="fileModalMode === 'push'">
          <label>本地文件
            <div class="row">
              <input :value="fileLocal" readonly placeholder="点击选择" style="flex:1" />
              <button @click="choosePushFile">选择</button>
            </div>
          </label>
          <label>设备路径<input v-model="fileRemote" placeholder="/sdcard/xxx" style="width:100%" /></label>
        </template>
        <template v-else>
          <label>设备路径<input v-model="fileRemote" placeholder="/sdcard/xxx" style="width:100%" /></label>
          <div class="muted">拉取保存位置将在确认时弹出选择框。</div>
        </template>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="fileModalOpen = false">取消</button>
        <button class="primary" @click="runFile">{{ fileModalMode === 'push' ? '推送' : '拉取' }}</button>
      </div>
    </div>
  </div>
</template>
