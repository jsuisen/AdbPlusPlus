<script setup>
// 命令输出弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { copyCmdOutput, saveCmdOutput } from '@/composables/useActions'

const { cmdModalOpen, cmdModal } = State
</script>

<template>
  <div v-if="cmdModalOpen" class="modal-mask" @click.self="maskClose(() => cmdModalOpen = false)">
    <div class="modal">
      <div class="modal-head">
        命令输出
        <button class="modal-x" @click="cmdModalOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="cmd-cmd">{{ cmdModal.cmd }}</div>
        <pre class="cmd-out">{{ cmdModal.body }}</pre>
      </div>
      <div class="modal-foot">
        <button @click="copyCmdOutput">复制</button>
        <button @click="saveCmdOutput">保存</button>
        <button class="primary" @click="cmdModalOpen = false">关闭</button>
      </div>
    </div>
  </div>
</template>
