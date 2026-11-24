<script setup>
// 重启设备弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closeRebootModal, runReboot } from '@/composables/useActions'
import { t } from '@/i18n'

const { rebootModalOpen, rebootMode } = State
</script>

<template>
  <div v-if="rebootModalOpen" class="modal-mask" @click.self="maskClose(closeRebootModal)">
    <div class="modal">
      <div class="modal-head">{{ t('action.reboot') }}<button class="modal-x" @click="closeRebootModal">×</button></div>
      <div class="modal-body">
        <label>{{ t('reboot.mode') }}
          <select v-model="rebootMode" style="width:100%">
            <option value="">{{ t('reboot.normal') }}</option>
            <option value="bootloader">{{ t('reboot.bootloader') }}</option>
            <option value="recovery">{{ t('reboot.recovery') }}</option>
          </select>
        </label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closeRebootModal">{{ t('common.cancel') }}</button>
        <button class="danger" @click="runReboot">{{ t('reboot.go') }}</button>
      </div>
    </div>
  </div>
</template>
