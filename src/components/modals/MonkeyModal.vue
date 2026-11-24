<script setup>
// Monkey 压力测试弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closeMonkeyModal, runMonkey } from '@/composables/useActions'
import { t } from '@/i18n'

const { monkeyModalOpen, monkeyPkg, monkeySeed, monkeyThrottle, monkeyCount } = State
</script>

<template>
  <div v-if="monkeyModalOpen" class="modal-mask" @click.self="maskClose(closeMonkeyModal)">
    <div class="modal">
      <div class="modal-head">{{ t('monkey.title') }}<button class="modal-x" @click="closeMonkeyModal">×</button></div>
      <div class="modal-body">
        <label>{{ t('modal.package') }}<input v-model="monkeyPkg" placeholder="com.example.app" style="width:100%" /></label>
        <label>{{ t('monkey.seed') }}<input v-model="monkeySeed" :placeholder="t('monkey.seedHint')" style="width:100%" /></label>
        <label>{{ t('monkey.throttle') }}<input v-model="monkeyThrottle" :placeholder="t('monkey.countHint')" style="width:100%" /></label>
        <label>{{ t('monkey.count') }}<input v-model="monkeyCount" placeholder="1000" style="width:100%" /></label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closeMonkeyModal">{{ t('common.cancel') }}</button>
        <button class="primary" @click="runMonkey">{{ t('common.start') }}</button>
      </div>
    </div>
  </div>
</template>
