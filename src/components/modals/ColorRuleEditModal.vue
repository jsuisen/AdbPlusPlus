<script setup>
// 关键字上色：新增 / 修改 规则弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { onDraftHexInput, onDraftBgInput, saveColorRule, deleteColorRule } from '@/composables/useColorrules'
import { t } from '@/i18n'

const { colorModalOpen, colorModalEditId, colorDraft, colorDraftErr } = State
</script>

<template>
  <div v-if="colorModalOpen" class="modal-mask color-rule-mask" @click.self="maskClose(() => colorModalOpen = false)">
    <div class="modal color-rule-modal">
      <div class="modal-head">
        {{ colorModalEditId != null ? t('color.editRule') : t('color.addRule') }}
        <button class="modal-x" @click="colorModalOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="cr-row"><span class="cr-label">{{ t('modal.colorKeyword') }}</span><input type="text" v-model="colorDraft.keyword" :placeholder="t('color.keyword')" spellcheck="false" /></div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.byTag" /><span>{{ t('color.byTag') }}</span></div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.byMsg" /><span>{{ t('color.byMsg') }}</span></div>
        <div class="cr-row cr-color">
          <span class="cr-label">{{ t('color.textColor') }}</span>
          <input type="color" v-model="colorDraft.color" :disabled="!colorDraft.bgOn" />
          <input type="text" class="color-hex-input" :value="colorDraft.color" :disabled="!colorDraft.bgOn" @input="onDraftHexInput($event.target.value)" maxlength="7" spellcheck="false" />
        </div>
        <div class="cr-row cr-color">
          <span class="cr-label">{{ t('modal.bgColor') }}</span>
          <input type="color" v-model="colorDraft.bgColor" :disabled="!colorDraft.bgOn" />
          <input type="text" class="color-hex-input" :value="colorDraft.bgColor" :disabled="!colorDraft.bgOn" @input="onDraftBgInput($event.target.value)" maxlength="7" spellcheck="false" />
        </div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.bold" /><span>{{ t('color.bold') }}</span></div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.bgOn" /><span>{{ t('common.enable') }}</span></div>
        <p v-if="colorDraftErr" class="muted small" style="color:var(--danger)">{{ colorDraftErr }}</p>
      </div>
      <div class="modal-foot">
        <button v-if="colorModalEditId != null" class="danger" @click="deleteColorRule">{{ t('common.delete') }}</button>
        <button @click="colorModalOpen = false">{{ t('common.cancel') }}</button>
        <button class="primary" @click="saveColorRule">{{ t('common.save') }}</button>
      </div>
    </div>
  </div>
</template>
