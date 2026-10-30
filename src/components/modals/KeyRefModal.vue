<script setup>
// 键值速查弹窗：KEYCODE 名称 ↔ 值对照表，支持搜索与复制
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { copyKeycodeTable } from '@/composables/useActions'

const { keyRefOpen, keyRefSearch, filteredKeycodes } = State
</script>

<template>
  <div v-if="keyRefOpen" class="modal-mask" @click.self="maskClose(() => keyRefOpen = false)">
    <div class="modal keyref-modal">
      <div class="modal-head">
        键值速查（KEYCODE）
        <div class="modal-head-acts">
          <button class="modal-x" @click="keyRefOpen = false">×</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="kr-toolbar">
          <input v-model="keyRefSearch" placeholder="搜索 名称 / 值 / 说明，例如 HOME、3、音量" />
          <span class="muted small">共 {{ filteredKeycodes.length }} 条</span>
        </div>
        <table class="kr-table">
          <thead>
            <tr><th class="kr-val">值</th><th>名称</th><th>说明</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredKeycodes" :key="r.value">
              <td class="kr-val">{{ r.value }}</td>
              <td class="kr-name">{{ r.name }}</td>
              <td class="kr-desc">{{ r.desc }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="modal-foot kr-foot">
        <span class="muted small">提示：可直接用鼠标选中表格内容复制</span>
        <button class="primary" @click="copyKeycodeTable">复制全部</button>
      </div>
    </div>
  </div>
</template>
