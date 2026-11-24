<script setup>
// 文件推送/拉取弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { choosePushFile, runFile } from '@/composables/useActions'
import { t } from '@/i18n'

const { fileModalOpen, fileModalMode, fileLocal, fileRemote } = State
</script>

<template>
  <div v-if="fileModalOpen" class="modal-mask" @click.self="maskClose(() => fileModalOpen = false)">
    <div class="modal">
      <div class="modal-head">{{ fileModalMode === 'push' ? t('file.pushTitle') : t('file.pullTitle') }}<button class="modal-x" @click="fileModalOpen = false">×</button></div>
      <div class="modal-body">
        <template v-if="fileModalMode === 'push'">
          <label>{{ t('file.local') }}
            <div class="row">
              <input :value="fileLocal" readonly :placeholder="t('common.clickToChoose')" style="flex:1" />
              <button @click="choosePushFile">{{ t('common.choose') }}</button>
            </div>
          </label>
          <label>{{ t('file.devicePath') }}<input v-model="fileRemote" placeholder="/sdcard/xxx" style="width:100%" /></label>
        </template>
        <template v-else>
          <label>{{ t('file.devicePath') }}<input v-model="fileRemote" placeholder="/sdcard/xxx" style="width:100%" /></label>
          <div class="muted">{{ t('file.pullHint') }}</div>
        </template>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="fileModalOpen = false">{{ t('common.cancel') }}</button>
        <button class="primary" @click="runFile">{{ fileModalMode === 'push' ? t('file.push') : t('file.pull') }}</button>
      </div>
    </div>
  </div>
</template>
