<script setup>
// 卸载应用弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { confirmUninstall } from '@/composables/useActions'
import { t } from '@/i18n'

const { uninstallModalOpen, uninstallKeep, appPkg } = State
</script>

<template>
  <div v-if="uninstallModalOpen" class="modal-mask" @click.self="maskClose(() => uninstallModalOpen = false)">
    <div class="modal">
      <div class="modal-head">{{ t('uninstall.title') }}<button class="modal-x" @click="uninstallModalOpen = false">×</button></div>
      <div class="modal-body">
        <label>{{ t('modal.package') }}<input v-model="appPkg" placeholder="com.example.app" style="width:100%" /></label>
        <label class="chk"><input type="checkbox" v-model="uninstallKeep" /> {{ t('uninstall.keepData') }}</label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="uninstallModalOpen = false">{{ t('common.cancel') }}</button>
        <button class="danger" @click="confirmUninstall">{{ t('common.uninstall') }}</button>
      </div>
    </div>
  </div>
</template>
