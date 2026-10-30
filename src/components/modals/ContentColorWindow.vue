<script setup>
// 日志窗口「颜色」弹窗：全局规则 + 本会话规则合并展示，本会话优先
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { openAddColorRule } from '@/composables/useColorrules'
import ColorRulesTable from '../ColorRulesTable.vue'

const { colorWinOpen, combinedColorRules, activeLogSerial } = State
</script>

<template>
  <div v-if="colorWinOpen" class="modal-mask color-modal-mask" @click.self="maskClose(() => colorWinOpen = false)">
    <div class="modal ccwin-modal">
      <div class="modal-head">
        日志内容颜色（{{ activeLogSerial || '设备' }}）
        <button class="modal-x" @click="colorWinOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="contentcolor-head">
          <span class="muted small">列表含「全局设置」与「本会话」规则，本会话优先；命中规则的颜色优先级高于级别颜色。带左色条者为「本会话」规则（不持久化）。</span>
          <button class="outdir-btn" @click="openAddColorRule('session')">新增</button>
        </div>
        <ColorRulesTable :items="combinedColorRules" session-aware />
      </div>
      <div class="modal-foot">
        <button class="primary" @click="colorWinOpen = false">关闭</button>
      </div>
    </div>
  </div>
</template>
