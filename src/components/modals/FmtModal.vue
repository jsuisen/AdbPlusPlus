<script setup>
// 日志格式弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { cancelFmt, confirmFmt } from '@/composables/useLogcat'
import { t } from '@/i18n'

const { fmtModalOpen, fmtDraft, exampleText } = State
</script>

<template>
  <div v-if="fmtModalOpen" class="modal-mask" @click.self="maskClose(cancelFmt)">
    <div class="modal">
      <div class="modal-head">
        {{ t('fmt.title') }}
        <button class="modal-x" @click="cancelFmt">×</button>
      </div>
      <div class="modal-body">
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.date" /> {{ t('fmt.date') }}</label>
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.pid" /> {{ t('fmt.pid') }}</label>
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.pkg" /> {{ t('fmt.package') }}</label>
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.tag" /> {{ t('fmt.tag') }}</label>
        <div class="fmt-example">
          <div class="fmt-example-label">{{ t('fmt.sample') }}</div>
          <input class="fmt-example-input" :value="exampleText" readonly />
        </div>
      </div>
      <div class="modal-foot">
        <button class="primary" @click="confirmFmt">{{ t('common.confirm') }}</button>
        <button @click="cancelFmt">{{ t('common.cancel') }}</button>
      </div>
    </div>
  </div>
</template>
