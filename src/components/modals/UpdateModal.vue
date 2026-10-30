<script setup>
// 「是否版本升级」对话框：由自动检测（本日未忽略时）或关于弹窗「版本检测」按钮触发。
// 因不接入 app:openExternal，确认动作为「复制开源工程地址到剪贴板 + toast 提示」。
import * as State from '@/composables/state'
import { useUpdate } from '@/composables/useUpdate'

const { updateOpen, updateInfo } = State
const { dismissToday, copyRepoUrl, closeDialog } = useUpdate()
</script>

<template>
  <div v-if="updateOpen" class="modal-mask" @click.self="closeDialog">
    <div class="modal">
      <div class="modal-head">
        版本升级
        <button class="modal-x" @click="dismissToday">×</button>
      </div>
      <div class="modal-body">
        <p>发现新版本 <b>v{{ updateInfo ? updateInfo.latest : '' }}</b>（当前 v{{ updateInfo ? updateInfo.current : '' }}）。</p>
        <p class="muted">是否前往开源工程查看更新？</p>
        <p class="muted small">{{ updateInfo ? updateInfo.url : '' }}</p>
      </div>
      <div class="modal-foot">
        <button class="primary" @click="copyRepoUrl">复制地址</button>
        <button @click="dismissToday">取消</button>
      </div>
    </div>
  </div>
</template>
