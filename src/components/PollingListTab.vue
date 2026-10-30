<script setup>
// 轮询检测列表 Tab：Service / 进程 / 线程 / 前台Activity 四个列表共用的
// 工具栏（过滤 + 开始/停止 + 刷新 + 自动刷新 + 间隔）与 加载中/未开始/结果框 骨架。
// 列表体各 Tab 不同，经默认 slot 传入。filter/auto/interval 经 defineModel 双向绑定到 state 层 ref。
const filter = defineModel('filter')
const auto = defineModel('auto')
const interval = defineModel('interval')

defineProps({
  running: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  label: { type: String, required: true },        // 结果框标题，如「前台 Activity」
  loadingText: { type: String, required: true }, // 加载中文案
  emptyText: { type: String, required: true },   // 未开始文案的宾语，如「前台 Activity」
  count: { type: Number, default: 0 },
  matched: { type: Number, default: 0 },
  serial: { type: String, default: '' }
})

defineEmits(['toggle', 'refresh'])
</script>

<template>
  <div class="listarea">
    <div class="list-toolbar">
      <input class="list-filter" v-model="filter" :disabled="!running" :placeholder="'过滤（共 ' + count + ' 个）'" />
      <button :class="running ? 'danger' : 'primary'" @click="$emit('toggle')">{{ running ? '停止' : '开始' }}</button>
      <button :disabled="!running" @click="$emit('refresh')">刷新</button>
      <label class="auto-chk"><input type="checkbox" v-model="auto" :disabled="!running" /> 自动刷新</label>
      <label class="auto-int">间隔(秒)<input type="number" min="1" v-model="interval" class="auto-int-input" :disabled="!running" /></label>
    </div>
    <div v-if="loading" class="muted">{{ loadingText }}</div>
    <div v-else-if="!running" class="muted">点击「开始」检测 {{ serial || '设备' }} 的 {{ emptyText }}…</div>
    <div v-else class="info-block">
      <div class="info-label">{{ label }}（共 {{ count }} 个{{ filter ? '，匹配 ' + matched : '' }}）</div>
      <div class="svc-list">
        <slot />
      </div>
    </div>
  </div>
</template>
