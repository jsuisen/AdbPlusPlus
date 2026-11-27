<script setup>
// 模拟按键弹窗（布局仿快捷按钮：分组下拉 + 管理 + 按键按钮）
import * as State from '@/composables/state'
import AppSelect from '../AppSelect.vue'
import { maskClose, saveCfg } from '@/composables/useConfig'
import { runKey, addKey, removeKey, onKeyColor, cmdTextColor } from '@/composables/useActions'
import { t } from '@/i18n'

const {
  keyModalOpen, keyRefOpen, keyGroup, keyGroups, keyManaging, displayKeys, keyButtons,
  newKeyName, newKeyValue, newKeyGroup, keyColorEditIndex, COLOR_PRESETS
} = State
</script>

<template>
  <div v-if="keyModalOpen" class="modal-mask" @click.self="maskClose(() => keyModalOpen = false)">
    <div class="modal key-modal">
      <div class="modal-head">
        {{ t('action.inputKey') }}
        <div class="modal-head-acts">
          <button class="ghost" @click="keyRefOpen = true">{{ t('keyref.open') }}</button>
          <button class="modal-x" @click="keyModalOpen = false">×</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="qb-head">
          <span class="qb-title">{{ t('action.inputKey') }}</span>
          <AppSelect v-model="keyGroup" class="qb-group"
                     :options="[{ value: State.ALL_GROUPS, label: t('quickbar.allGroups') }, ...keyGroups]" />
          <button class="qb-manage" @click="keyManaging = !keyManaging">{{ keyManaging ? t('common.done') : t('common.manage') }}</button>
        </div>
        <div class="qb-buttons">
          <button v-for="(k, i) in displayKeys" :key="k.name + '-' + i" class="qbtn" :style="{ background: k.color || '', color: cmdTextColor(k.color) }" @click="runKey(k)">{{ k.nameKey ? t(k.nameKey) : k.name }}</button>
          <span v-if="!displayKeys.length" class="muted">{{ t('key.noKeys') }}</span>
        </div>
        <div v-if="keyManaging" class="qb-edit">
          <div class="row">
            <input v-model="newKeyName" :placeholder="t('key.name')" style="width:120px" />
            <input v-model="newKeyValue" :placeholder="t('key.valueHint')" style="flex:1" />
            <input v-model="newKeyGroup" :placeholder="t('quickbar.groupOptional')" style="width:110px" />
            <button class="primary" @click="addKey">{{ t('common.add') }}</button>
          </div>
          <div class="cmdlist">
            <div v-for="(k, i) in keyButtons" :key="i" class="cmditem">
              <input class="ci-name" v-model="k.name" @change="saveCfg" :placeholder="t('key.name')" />
              <input class="ci-args" v-model="k.key" @change="saveCfg" :placeholder="t('key.value')" />
              <input class="ci-group" v-model="k.group" @change="saveCfg" :placeholder="t('quickbar.group')" />
              <button class="ci-color" @click="keyColorEditIndex = (keyColorEditIndex === i ? null : i)">{{ t('common.color') }}</button>
              <button class="ci-del" @click="removeKey(i)">{{ t('common.delete') }}</button>
              <div v-if="keyColorEditIndex === i" class="color-pop">
                <input type="color" :value="k.color || '#4a90d9'" @input="onKeyColor(i, $event.target.value)" />
                <div class="swatches">
                  <button v-for="sw in COLOR_PRESETS" :key="sw" :style="{ background: sw }" @click="onKeyColor(i, sw)" :title="sw"></button>
                </div>
                <button class="ci-ok" @click="keyColorEditIndex = null">{{ t('common.done') }}</button>
              </div>
            </div>
          </div>
          <p class="muted small">{{ t('key.presetHint') }}</p>
        </div>
      </div>
      <div class="modal-foot"><button class="primary" @click="keyModalOpen = false">{{ t('common.close') }}</button></div>
    </div>
  </div>
</template>
