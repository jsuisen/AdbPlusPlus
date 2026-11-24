<script setup>
// 重命名设备弹窗
import * as State from '@/composables/state'
import { confirmRenameDevice } from '@/composables/useDevices'
import { t } from '@/i18n'

const { renameOpen, renameValue } = State
</script>

<template>
  <div v-if="renameOpen" class="modal-mask" @click.self="renameOpen = false">
    <div class="modal connect-modal">
      <div class="modal-head">{{ t('rename.title') }} <button class="modal-x" @click="renameOpen = false">×</button></div>
      <div class="modal-body connect-body">
        <label class="cf-row"><span>{{ t('common.alias') }}</span><input v-model="renameValue" :placeholder="t('rename.name')" /></label>
      </div>
      <div class="modal-foot">
        <button @click="renameOpen = false">{{ t('common.cancel') }}</button>
        <button class="primary" @click="confirmRenameDevice">{{ t('common.confirm') }}</button>
      </div>
    </div>
  </div>
</template>
