<script setup>
// 安装 APK 弹窗（附加参数选项）
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { confirmInstall } from '@/composables/useActions'
import { t } from '@/i18n'

const { installModalOpen, installOpts } = State
</script>

<template>
  <div v-if="installModalOpen" class="modal-mask" @click.self="maskClose(() => installModalOpen = false)">
    <div class="modal">
      <div class="modal-head">{{ t('install.title') }}<button class="modal-x" @click="installModalOpen = false">×</button></div>
      <div class="modal-body">
        <div class="chk-row">
          <label class="chk"><input type="checkbox" v-model="installOpts.d" /> {{ t('install.downgrade') }}</label>
          <label class="chk"><input type="checkbox" v-model="installOpts.g" /> {{ t('install.grantAll') }}</label>
          <label class="chk"><input type="checkbox" v-model="installOpts.t" /> {{ t('install.testPkg') }}</label>
        </div>
        <div class="muted">{{ t('install.hint') }}</div>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="installModalOpen = false">{{ t('common.cancel') }}</button>
        <button class="primary" @click="confirmInstall">{{ t('install.pickAndInstall') }}</button>
      </div>
    </div>
  </div>
</template>
