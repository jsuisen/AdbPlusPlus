<script setup>
// 安装 APK 弹窗（附加参数选项）
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { confirmInstall } from '@/composables/useActions'

const { installModalOpen, installOpts } = State
</script>

<template>
  <div v-if="installModalOpen" class="modal-mask" @click.self="maskClose(() => installModalOpen = false)">
    <div class="modal">
      <div class="modal-head">安装 APK<button class="modal-x" @click="installModalOpen = false">×</button></div>
      <div class="modal-body">
        <div class="chk-row">
          <label class="chk"><input type="checkbox" v-model="installOpts.d" /> 允许降级(-d)</label>
          <label class="chk"><input type="checkbox" v-model="installOpts.g" /> 授予全部权限(-g)</label>
          <label class="chk"><input type="checkbox" v-model="installOpts.t" /> 允许测试包(-t)</label>
        </div>
        <div class="muted">默认 -r（覆盖安装、保留数据）。确认后会弹出选择 APK 文件。</div>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="installModalOpen = false">取消</button>
        <button class="primary" @click="confirmInstall">选择 APK 并安装</button>
      </div>
    </div>
  </div>
</template>
