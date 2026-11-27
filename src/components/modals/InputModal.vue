<script setup>
// 输入类动作弹窗（输入文本 / 模拟点击 / 模拟滑动；值字段按类型不同）
import * as State from '@/composables/state'
import AppSelect from '../AppSelect.vue'
import { maskClose, saveCfg } from '@/composables/useConfig'
import { runInput, addInput, removeInput, onInputColor, cmdTextColor } from '@/composables/useActions'
import { t } from '@/i18n'

const {
  inputModalOpen, inputModalType, inputGroup, inputGroups, inputManaging, displayInputs,
  inputButtons, newInputName, newInputGroup, newInputVal, inputColorEditIndex,
  INPUT_TYPES, INPUT_VALUE_FIELDS, COLOR_PRESETS
} = State
</script>

<template>
  <div v-if="inputModalOpen" class="modal-mask" @click.self="maskClose(() => inputModalOpen = false)">
    <div class="modal input-modal">
      <div class="modal-head">
        {{ t(INPUT_TYPES[inputModalType].titleKey) }}
        <button class="modal-x" @click="inputModalOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="qb-head">
          <span class="qb-title">{{ t(INPUT_TYPES[inputModalType].titleKey) }}</span>
          <AppSelect v-model="inputGroup" class="qb-group"
                     :options="[{ value: State.ALL_GROUPS, label: t('quickbar.allGroups') }, ...inputGroups]" />
          <button class="qb-manage" @click="inputManaging = !inputManaging">{{ inputManaging ? t('common.done') : t('common.manage') }}</button>
        </div>
        <div class="qb-buttons">
          <button v-for="(k, i) in displayInputs" :key="k.name + '-' + i" class="qbtn" :style="{ background: k.color || '', color: cmdTextColor(k.color) }" @click="runInput(k)">{{ k.nameKey ? t(k.nameKey) : k.name }}</button>
          <span v-if="!displayInputs.length" class="muted">{{ t('quickbar.noSaved') }}</span>
        </div>
        <div v-if="inputManaging" class="qb-edit">
          <div class="row" style="flex-wrap:nowrap">
            <input v-model="newInputName" :placeholder="t('common.name')" style="width:60px" />
            <template v-for="f in INPUT_VALUE_FIELDS[inputModalType]" :key="f.prop">
              <input v-model="newInputVal[f.prop]" :placeholder="f.labelKey ? t(f.labelKey) : f.label" :type="f.type === 'num' ? 'number' : 'text'" :class="f.type === 'num' ? 'ci-num' : 'ci-args'" :style="f.type === 'num' ? 'width:60px' : ''" />
            </template>
            <input v-model="newInputGroup" :placeholder="t('quickbar.group')" style="width:60px" />
            <button class="primary" @click="addInput">{{ t('common.add') }}</button>
          </div>
          <div class="cmdlist">
            <div v-for="(k, i) in inputButtons" :key="i" class="cmditem">
              <input class="ci-name" v-model="k.name" @change="saveCfg" :placeholder="t('common.name')" style="width:60px" />
              <template v-for="f in INPUT_VALUE_FIELDS[inputModalType]" :key="f.prop">
                <input v-model="k[f.prop]" @change="saveCfg" :placeholder="f.labelKey ? t(f.labelKey) : f.label" :type="f.type === 'num' ? 'number' : 'text'" :class="f.type === 'num' ? 'ci-num' : 'ci-args'" :style="f.type === 'num' ? 'width:60px' : ''" />
              </template>
              <input class="ci-group" v-model="k.group" @change="saveCfg" :placeholder="t('quickbar.group')" style="width:60px" />
              <button class="ci-color" @click="inputColorEditIndex = (inputColorEditIndex === i ? null : i)">{{ t('common.color') }}</button>
              <button class="ci-del" @click="removeInput(i)">{{ t('common.delete') }}</button>
              <div v-if="inputColorEditIndex === i" class="color-pop">
                <input type="color" :value="k.color || '#4a90d9'" @input="onInputColor(i, $event.target.value)" />
                <div class="swatches">
                  <button v-for="sw in COLOR_PRESETS" :key="sw" :style="{ background: sw }" @click="onInputColor(i, sw)" :title="sw"></button>
                </div>
                <button class="ci-ok" @click="inputColorEditIndex = null">{{ t('common.done') }}</button>
              </div>
            </div>
          </div>
          <p class="muted small">{{ t('input.manageHint', { type: t(INPUT_TYPES[inputModalType].titleKey) }) }}</p>
        </div>
      </div>
      <div class="modal-foot"><button class="primary" @click="inputModalOpen = false">{{ t('common.close') }}</button></div>
    </div>
  </div>
</template>
