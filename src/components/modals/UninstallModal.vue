<script setup>
// 卸载应用弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { confirmUninstall } from '@/composables/useActions'

const { uninstallModalOpen, uninstallKeep, appPkg } = State
</script>

<template>
  <div v-if="uninstallModalOpen" class="modal-mask" @click.self="maskClose(() => uninstallModalOpen = false)">
    <div class="modal">
      <div class="modal-head">卸载应用<button class="modal-x" @click="uninstallModalOpen = false">×</button></div>
      <div class="modal-body">
        <label>包名<input v-model="appPkg" placeholder="com.example.app" style="width:100%" /></label>
        <label class="chk"><input type="checkbox" v-model="uninstallKeep" /> 保留数据与缓存(-k)</label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="uninstallModalOpen = false">取消</button>
        <button class="danger" @click="confirmUninstall">卸载</button>
      </div>
    </div>
  </div>
</template>
