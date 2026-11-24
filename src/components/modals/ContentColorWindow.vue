<script setup>
// 日志窗口「颜色」弹窗：全局规则 + 本会话规则合并展示，本会话优先
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { openAddColorRule } from '@/composables/useColorrules'
import ColorRulesTable from '../ColorRulesTable.vue'
import { t } from '@/i18n'

const { colorWinOpen, combinedColorRules, activeLogSerial } = State
</script>

<template>
  <div v-if="colorWinOpen" class="modal-mask color-modal-mask" @click.self="maskClose(() => colorWinOpen = false)">
    <div class="modal ccwin-modal">
      <div class="modal-head">
        {{ t('color.windowTitle', { dev: activeLogSerial || t('common.device') }) }}
        <button class="modal-x" @click="colorWinOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="contentcolor-head">
          <span class="muted small">{{ t('color.windowHint') }}</span>
          <button class="outdir-btn" @click="openAddColorRule('session')">{{ t('common.addNew') }}</button>
        </div>
        <ColorRulesTable :items="combinedColorRules" session-aware />
      </div>
      <div class="modal-foot">
        <button class="primary" @click="colorWinOpen = false">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>
