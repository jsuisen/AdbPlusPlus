<script setup>
// 输入类动作弹窗（输入文本 / 模拟点击 / 模拟滑动；值字段按类型不同）
import * as State from '@/composables/state'
import { maskClose, saveCfg } from '@/composables/useConfig'
import { runInput, addInput, removeInput, onInputColor, cmdTextColor } from '@/composables/useActions'

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
        {{ INPUT_TYPES[inputModalType].title }}
        <button class="modal-x" @click="inputModalOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="qb-head">
          <span class="qb-title">{{ INPUT_TYPES[inputModalType].title }}</span>
          <select v-model="inputGroup" class="qb-group">
            <option value="全部">全部分组</option>
            <option v-for="gp in inputGroups" :key="gp" :value="gp">{{ gp }}</option>
          </select>
          <button class="qb-manage" @click="inputManaging = !inputManaging">{{ inputManaging ? '完成' : '管理' }}</button>
        </div>
        <div class="qb-buttons">
          <button v-for="(k, i) in displayInputs" :key="k.name + '-' + i" class="qbtn" :style="{ background: k.color || '', color: cmdTextColor(k.color) }" @click="runInput(k)">{{ k.name }}</button>
          <span v-if="!displayInputs.length" class="muted">暂无保存项，点「管理」添加。</span>
        </div>
        <div v-if="inputManaging" class="qb-edit">
          <div class="row" style="flex-wrap:nowrap">
            <input v-model="newInputName" placeholder="名称" style="width:60px" />
            <template v-for="f in INPUT_VALUE_FIELDS[inputModalType]" :key="f.prop">
              <input v-model="newInputVal[f.prop]" :placeholder="f.label" :type="f.type === 'num' ? 'number' : 'text'" :class="f.type === 'num' ? 'ci-num' : 'ci-args'" :style="f.type === 'num' ? 'width:60px' : ''" />
            </template>
            <input v-model="newInputGroup" placeholder="分组" style="width:60px" />
            <button class="primary" @click="addInput">添加</button>
          </div>
          <div class="cmdlist">
            <div v-for="(k, i) in inputButtons" :key="i" class="cmditem">
              <input class="ci-name" v-model="k.name" @change="saveCfg" placeholder="名称" style="width:60px" />
              <template v-for="f in INPUT_VALUE_FIELDS[inputModalType]" :key="f.prop">
                <input v-model="k[f.prop]" @change="saveCfg" :placeholder="f.label" :type="f.type === 'num' ? 'number' : 'text'" :class="f.type === 'num' ? 'ci-num' : 'ci-args'" :style="f.type === 'num' ? 'width:60px' : ''" />
              </template>
              <input class="ci-group" v-model="k.group" @change="saveCfg" placeholder="分组" style="width:60px" />
              <button class="ci-color" @click="inputColorEditIndex = (inputColorEditIndex === i ? null : i)">颜色</button>
              <button class="ci-del" @click="removeInput(i)">删除</button>
              <div v-if="inputColorEditIndex === i" class="color-pop">
                <input type="color" :value="k.color || '#4a90d9'" @input="onInputColor(i, $event.target.value)" />
                <div class="swatches">
                  <button v-for="sw in COLOR_PRESETS" :key="sw" :style="{ background: sw }" @click="onInputColor(i, sw)" :title="sw"></button>
                </div>
                <button class="ci-ok" @click="inputColorEditIndex = null">完成</button>
              </div>
            </div>
          </div>
          <p class="muted small">可保存常用「{{ INPUT_TYPES[inputModalType].title }}」动作（名称、值、分组、颜色），点按钮即发送；此处仅管理你新增的项。时长(ms) 为滑动可选，留空则按系统默认速度。</p>
        </div>
      </div>
      <div class="modal-foot"><button class="primary" @click="inputModalOpen = false">关闭</button></div>
    </div>
  </div>
</template>
