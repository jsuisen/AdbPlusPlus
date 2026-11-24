<script setup>
// 「是否版本升级」对话框：由自动检测（本日未忽略时）或关于弹窗「版本检测」按钮触发。
// 因不接入 app:openExternal，确认动作为「复制开源工程地址到剪贴板 + toast 提示」。
import * as State from '@/composables/state'
import { useUpdate } from '@/composables/useUpdate'
import { t } from '@/i18n'

const { updateOpen, updateInfo } = State
const { dismissToday, copyRepoUrl, closeDialog } = useUpdate()
</script>

<template>
  <div v-if="updateOpen" class="modal-mask" @click.self="closeDialog">
    <div class="modal">
      <div class="modal-head">
        {{ t('update.title') }}
        <button class="modal-x" @click="dismissToday">×</button>
      </div>
      <div class="modal-body">
        <p>{{ t('update.detail', { latest: updateInfo ? updateInfo.latest : '', current: updateInfo ? updateInfo.current : '' }) }}</p>
        <p class="muted">{{ t('update.ask') }}</p>
        <p class="muted small">{{ updateInfo ? updateInfo.url : '' }}</p>
      </div>
      <div class="modal-foot">
        <button class="primary" @click="copyRepoUrl">{{ t('update.copyUrl') }}</button>
        <button @click="dismissToday">{{ t('common.cancel') }}</button>
      </div>
    </div>
  </div>
</template>
