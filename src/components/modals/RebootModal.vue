<script setup>
// 重启设备弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closeRebootModal, runReboot } from '@/composables/useActions'

const { rebootModalOpen, rebootMode } = State
</script>

<template>
  <div v-if="rebootModalOpen" class="modal-mask" @click.self="maskClose(closeRebootModal)">
    <div class="modal">
      <div class="modal-head">重启设备<button class="modal-x" @click="closeRebootModal">×</button></div>
      <div class="modal-body">
        <label>模式
          <select v-model="rebootMode" style="width:100%">
            <option value="">正常重启</option>
            <option value="bootloader">bootloader（引导模式）</option>
            <option value="recovery">recovery（恢复模式）</option>
          </select>
        </label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closeRebootModal">取消</button>
        <button class="danger" @click="runReboot">重启</button>
      </div>
    </div>
  </div>
</template>
