<script setup>
// 重命名设备弹窗
import * as State from '@/composables/state'
import { confirmRenameDevice } from '@/composables/useDevices'

const { renameOpen, renameValue } = State
</script>

<template>
  <div v-if="renameOpen" class="modal-mask" @click.self="renameOpen = false">
    <div class="modal connect-modal">
      <div class="modal-head">重命名设备 <button class="modal-x" @click="renameOpen = false">×</button></div>
      <div class="modal-body connect-body">
        <label class="cf-row"><span>别名</span><input v-model="renameValue" placeholder="设备显示名" /></label>
      </div>
      <div class="modal-foot">
        <button @click="renameOpen = false">取消</button>
        <button class="primary" @click="confirmRenameDevice">确认</button>
      </div>
    </div>
  </div>
</template>
