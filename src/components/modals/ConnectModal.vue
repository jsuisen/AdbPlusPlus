<script setup>
// 连接设备弹窗（adb connect ip:port，可选别名）
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { confirmConnect } from '@/composables/useDevices'

const { connectOpen, connectIp, connectPort, connectAlias } = State
</script>

<template>
  <div v-if="connectOpen" class="modal-mask" @click.self="maskClose(() => connectOpen = false)">
    <div class="modal connect-modal">
      <div class="modal-head">连接设备 <button class="modal-x" @click="connectOpen = false">×</button></div>
      <div class="modal-body connect-body">
        <label class="cf-row"><span>IP</span><input v-model="connectIp" placeholder="如 192.168.1.10" /></label>
        <label class="cf-row"><span>端口</span><input v-model="connectPort" placeholder="默认 5555" /></label>
        <label class="cf-row"><span>别名</span><input v-model="connectAlias" placeholder="可选，非空且连接成功后作为设备显示名" /></label>
      </div>
      <div class="modal-foot">
        <button @click="connectOpen = false">取消</button>
        <button class="primary" @click="confirmConnect">确认</button>
      </div>
    </div>
  </div>
</template>
