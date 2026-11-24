<script setup>
// 快筛：Tag 快速过滤弹窗
import * as State from '@/composables/state'
import { closeQuickFilter, toggleAllQf, invertQf, resetQf } from '@/composables/useLogcat'
import { t } from '@/i18n'

const { activeLogSerial, qfOpen, qfSearch, qfTags, qfAllChecked, qfTagsFiltered } = State
</script>

<template>
  <div v-if="qfOpen" class="modal-mask" @click.self="closeQuickFilter">
    <div class="modal qf-modal">
      <div class="modal-head">
        {{ t('quickfilter.title', { dev: activeLogSerial || t('common.device') }) }}
        <button class="modal-x" @click="closeQuickFilter">×</button>
      </div>
      <div class="modal-body">
        <div class="qf-search">
          <input v-model="qfSearch" :placeholder="t('quickfilter.hint')" />
          <button class="qf-clear" type="button" @click="qfSearch = ''" :title="t('apk.clearFilter')">×</button>
        </div>
        <div class="qf-table-scroll">
          <table class="qf-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th class="qf-num">{{ t('quickfilter.count') }}</th>
                <th class="qf-chk">
                  <span class="qf-all"><input type="checkbox" :checked="qfAllChecked" @change="toggleAllQf" /> {{ t('quickfilter.show') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in qfTagsFiltered" :key="t.tag">
                <td class="qf-tag">{{ t.tag.trim() }}</td>
                <td class="qf-num">{{ t.count }}</td>
                <td class="qf-chk"><input type="checkbox" v-model="t.checked" /></td>
              </tr>
              <tr v-if="!qfTagsFiltered.length"><td colspan="3" class="muted">{{ qfTags.length ? t('quickfilter.noMatch') : t('quickfilter.noLogs') }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-foot">
        <button @click="invertQf">{{ t('quickfilter.invert') }}</button>
        <button @click="resetQf">{{ t('common.reset') }}</button>
        <button class="primary" @click="closeQuickFilter">{{ t('common.apply') }}</button>
        <button @click="closeQuickFilter">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>
