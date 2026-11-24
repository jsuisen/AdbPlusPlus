<script setup>
// 键值速查弹窗：KEYCODE 名称 ↔ 值对照表，支持搜索与复制
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { copyKeycodeTable } from '@/composables/useActions'
import { t, tKeycode } from '@/i18n'

const { keyRefOpen, keyRefSearch, filteredKeycodes } = State
</script>

<template>
  <div v-if="keyRefOpen" class="modal-mask" @click.self="maskClose(() => keyRefOpen = false)">
    <div class="modal keyref-modal">
      <div class="modal-head">
        {{ t('keyref.title') }}
        <div class="modal-head-acts">
          <button class="modal-x" @click="keyRefOpen = false">×</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="kr-toolbar">
          <input v-model="keyRefSearch" :placeholder="t('keyref.searchHint')" />
          <span class="muted small">{{ t('keyref.count', { n: filteredKeycodes.length }) }}</span>
        </div>
        <table class="kr-table">
          <thead>
            <tr><th class="kr-val">{{ t('keyref.value') }}</th><th>{{ t('common.name') }}</th><th>{{ t('keyref.desc') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredKeycodes" :key="r.value">
              <td class="kr-val">{{ r.value }}</td>
              <td class="kr-name">{{ r.name }}</td>
              <td class="kr-desc">{{ tKeycode(r.name) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-foot kr-foot">
        <span class="muted small">{{ t('keyref.copyHint') }}</span>
        <button class="primary" @click="copyKeycodeTable">{{ t('keyref.copyAll') }}</button>
      </div>
    </div>
  </div>
</template>
