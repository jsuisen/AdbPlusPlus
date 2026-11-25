<script setup>
// 非阻断式「进行中」加载指示：独立小浮层，不使用 modal-mask，
// CSS pointer-events:none 保证后台所有按钮/列表/日志区仍可点击与滚动。
import * as State from '@/composables/state'

const { blockingBusy, blockingBusyText, busy, busyText } = State
</script>

<template>
  <div v-if="blockingBusy" class="blocking-busy-mask" role="alertdialog" aria-busy="true" :aria-label="blockingBusyText">
    <div class="blocking-busy-card">
      <span class="busy-spinner"></span>
      <span>{{ blockingBusyText }}</span>
    </div>
  </div>
  <div v-if="busy && !blockingBusy" class="busy-pill" role="status" aria-live="polite">
    <span class="busy-spinner"></span>
    <span>{{ busyText }}</span>
  </div>
</template>
