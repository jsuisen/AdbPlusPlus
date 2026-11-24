<script setup>
// 命令输出弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { copyCmdOutput, saveCmdOutput } from '@/composables/useActions'
import { t } from '@/i18n'

const { cmdModalOpen, cmdModal } = State
</script>

<template>
  <div v-if="cmdModalOpen" class="modal-mask" @click.self="maskClose(() => cmdModalOpen = false)">
    <div class="modal">
      <div class="modal-head">
        {{ t('modal.cmdOutput') }}
        <button class="modal-x" @click="cmdModalOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="cmd-cmd">{{ cmdModal.cmd }}</div>
        <pre class="cmd-out">{{ cmdModal.body }}</pre>
      </div>
      <div class="modal-foot">
        <button @click="copyCmdOutput">{{ t('common.copy') }}</button>
        <button @click="saveCmdOutput">{{ t('common.save') }}</button>
        <button class="primary" @click="cmdModalOpen = false">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>
