<script setup>
// 非阻断式「进行中」加载指示：独立小浮层，不使用 modal-mask，
// CSS pointer-events:none 保证后台所有按钮/列表/日志区仍可点击与滚动。
import * as State from '@/composables/state'

const { busy, busyText } = State
</script>

<template>
  <div v-if="busy" class="busy-pill" role="status" aria-live="polite">
    <span class="busy-spinner"></span>
    <span>{{ busyText }}</span>
  </div>
</template>
