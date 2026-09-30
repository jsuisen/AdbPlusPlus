<script setup>
// 设备右键菜单（保存 / 重命名）
import * as State from '@/composables/state'
import { closeDeviceCtxMenu, ctxSaveDevice, ctxRenameDevice } from '@/composables/useDevices'

const { deviceCtxMenu } = State
</script>

<template>
  <div v-if="deviceCtxMenu.open" class="ctx-overlay" @click="closeDeviceCtxMenu">
    <div class="dev-ctx-menu" :style="{ left: deviceCtxMenu.x + 'px', top: deviceCtxMenu.y + 'px' }" @click.stop>
      <button class="dev-ctx-item" @click="ctxSaveDevice">保存</button>
      <button class="dev-ctx-item" @click="ctxRenameDevice">重命名</button>
    </div>
  </div>
</template>
