<script setup>
// Monkey 压力测试弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closeMonkeyModal, runMonkey } from '@/composables/useActions'

const { monkeyModalOpen, monkeyPkg, monkeySeed, monkeyThrottle, monkeyCount } = State
</script>

<template>
  <div v-if="monkeyModalOpen" class="modal-mask" @click.self="maskClose(closeMonkeyModal)">
    <div class="modal">
      <div class="modal-head">Monkey 压力测试<button class="modal-x" @click="closeMonkeyModal">×</button></div>
      <div class="modal-body">
        <label>包名<input v-model="monkeyPkg" placeholder="com.example.app" style="width:100%" /></label>
        <label>种子 seed（可选）<input v-model="monkeySeed" placeholder="如 100" style="width:100%" /></label>
        <label>事件间隔 throttle(ms)（可选）<input v-model="monkeyThrottle" placeholder="如 500" style="width:100%" /></label>
        <label>事件数 count<input v-model="monkeyCount" placeholder="1000" style="width:100%" /></label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closeMonkeyModal">取消</button>
        <button class="primary" @click="runMonkey">开始</button>
      </div>
    </div>
  </div>
</template>
