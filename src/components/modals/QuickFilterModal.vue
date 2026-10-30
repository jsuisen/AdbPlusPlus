<script setup>
// 快筛：Tag 快速过滤弹窗
import * as State from '@/composables/state'
import { closeQuickFilter, toggleAllQf, invertQf, resetQf } from '@/composables/useLogcat'

const { activeLogSerial, qfOpen, qfSearch, qfTags, qfAllChecked, qfTagsFiltered } = State
</script>

<template>
  <div v-if="qfOpen" class="modal-mask" @click.self="closeQuickFilter">
    <div class="modal qf-modal">
      <div class="modal-head">
        快筛 · Tag 过滤（{{ activeLogSerial || '设备' }}）
        <button class="modal-x" @click="closeQuickFilter">×</button>
      </div>
      <div class="modal-body">
        <div class="qf-search">
          <input v-model="qfSearch" placeholder="过滤 Tag（部分匹配，忽略大小写）" />
          <button class="qf-clear" type="button" @click="qfSearch = ''" title="清空过滤框">×</button>
        </div>
        <div class="qf-table-scroll">
          <table class="qf-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th class="qf-num">数量</th>
                <th class="qf-chk">
                  <span class="qf-all"><input type="checkbox" :checked="qfAllChecked" @change="toggleAllQf" /> 显示</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in qfTagsFiltered" :key="t.tag">
                <td class="qf-tag">{{ t.tag.trim() }}</td>
                <td class="qf-num">{{ t.count }}</td>
                <td class="qf-chk"><input type="checkbox" v-model="t.checked" /></td>
              </tr>
              <tr v-if="!qfTagsFiltered.length"><td colspan="3" class="muted">{{ qfTags.length ? '无匹配的 Tag' : '当前设备暂无带 Tag 的日志，请先点「开始」采集。' }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-foot">
        <button @click="invertQf">反选</button>
        <button @click="resetQf">重置</button>
        <button class="primary" @click="closeQuickFilter">应用</button>
        <button @click="closeQuickFilter">关闭</button>
      </div>
    </div>
  </div>
</template>
