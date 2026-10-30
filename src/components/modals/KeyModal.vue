<script setup>
// 模拟按键弹窗（布局仿快捷按钮：分组下拉 + 管理 + 按键按钮）
import * as State from '@/composables/state'
import { maskClose, saveCfg } from '@/composables/useConfig'
import { runKey, addKey, removeKey, onKeyColor, cmdTextColor } from '@/composables/useActions'

const {
  keyModalOpen, keyGroup, keyGroups, keyManaging, displayKeys, keyButtons,
  newKeyName, newKeyValue, newKeyGroup, keyColorEditIndex, COLOR_PRESETS
} = State
</script>

<template>
  <div v-if="keyModalOpen" class="modal-mask" @click.self="maskClose(() => keyModalOpen = false)">
    <div class="modal key-modal">
      <div class="modal-head">
        模拟按键
        <div class="modal-head-acts">
          <button class="ghost" @click="keyRefOpen = true">速查</button>
          <button class="modal-x" @click="keyModalOpen = false">×</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="qb-head">
          <span class="qb-title">模拟按键</span>
          <select v-model="keyGroup" class="qb-group">
            <option value="全部">全部分组</option>
            <option v-for="gp in keyGroups" :key="gp" :value="gp">{{ gp }}</option>
          </select>
          <button class="qb-manage" @click="keyManaging = !keyManaging">{{ keyManaging ? '完成' : '管理' }}</button>
        </div>
        <div class="qb-buttons">
          <button v-for="(k, i) in displayKeys" :key="k.name + '-' + i" class="qbtn" :style="{ background: k.color || '', color: cmdTextColor(k.color) }" @click="runKey(k)">{{ k.name }}</button>
          <span v-if="!displayKeys.length" class="muted">暂无按键。</span>
        </div>
        <div v-if="keyManaging" class="qb-edit">
          <div class="row">
            <input v-model="newKeyName" placeholder="按键名" style="width:120px" />
            <input v-model="newKeyValue" placeholder="键值（如 KEYCODE_APP_SWITCH 或 187）" style="flex:1" />
            <input v-model="newKeyGroup" placeholder="分组(可选)" style="width:110px" />
            <button class="primary" @click="addKey">添加</button>
          </div>
          <div class="cmdlist">
            <div v-for="(k, i) in keyButtons" :key="i" class="cmditem">
              <input class="ci-name" v-model="k.name" @change="saveCfg" placeholder="按键名" />
              <input class="ci-args" v-model="k.key" @change="saveCfg" placeholder="键值" />
              <input class="ci-group" v-model="k.group" @change="saveCfg" placeholder="分组" />
              <button class="ci-color" @click="keyColorEditIndex = (keyColorEditIndex === i ? null : i)">颜色</button>
              <button class="ci-del" @click="removeKey(i)">删除</button>
              <div v-if="keyColorEditIndex === i" class="color-pop">
                <input type="color" :value="k.color || '#4a90d9'" @input="onKeyColor(i, $event.target.value)" />
                <div class="swatches">
                  <button v-for="sw in COLOR_PRESETS" :key="sw" :style="{ background: sw }" @click="onKeyColor(i, sw)" :title="sw"></button>
                </div>
                <button class="ci-ok" @click="keyColorEditIndex = null">完成</button>
              </div>
            </div>
          </div>
          <p class="muted small">预设键（返回/主页/菜单/电源/音量±/静音/亮度±/播放控制）为内置，不可删除；此处仅管理你新增的按键。</p>
        </div>
      </div>
      <div class="modal-foot"><button class="primary" @click="keyModalOpen = false">关闭</button></div>
    </div>
  </div>
</template>
