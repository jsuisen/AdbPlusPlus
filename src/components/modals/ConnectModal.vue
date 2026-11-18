<script setup>
// 连接设备弹窗（adb connect ip:port，可选别名 + 成功历史回填 + 连接中/超时提示）
import { computed } from 'vue'
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { applyConnectHistory, cancelConnect, confirmConnect } from '@/composables/useDevices'

const { connectOpen, connectIp, connectPort, connectAlias, connectHistorySel, connecting, connectTimedOut, CONNECT_TIMEOUT_MS, cfg } = State

// 历史下拉选项：直接跟随 cfg（唯一持久化源）生成，显示 ip:port(别名)，无别名不显示括号
const connectHistoryOptions = computed(() => {
  const hist = Array.isArray(cfg.value.connectHistory) ? cfg.value.connectHistory : []
  return hist.filter((h) => h && h.ip).map((h) => {
    const addr = `${h.ip}:${h.port || '5555'}`
    return { value: addr, label: h.alias ? `${addr}(${h.alias})` : addr }
  })
})

function onMaskClick() {
  // 连接中点遮罩等同取消：强杀本次 adb 连接，不让用户在无反馈状态下误以为卡死
  if (connecting.value) { cancelConnect(); return }
  maskClose(() => { connectOpen.value = false })
}

function onCancelClick() {
  if (connecting.value) cancelConnect()
  else connectOpen.value = false
}
</script>

<template>
  <div v-if="connectOpen" class="modal-mask" @click.self="onMaskClick">
    <div class="modal connect-modal">
      <div class="modal-head">连接设备 <button class="modal-x" @click="onCancelClick">×</button></div>
      <div class="modal-body connect-body">
        <label class="cf-row"><span>IP</span><input v-model="connectIp" :disabled="connecting" placeholder="如 192.168.1.10" /></label>
        <label class="cf-row"><span>端口</span><input v-model="connectPort" :disabled="connecting" placeholder="默认 5555" /></label>
        <label class="cf-row">
          <span>历史</span>
          <select v-model="connectHistorySel" :disabled="connecting || !connectHistoryOptions.length" @change="applyConnectHistory">
            <option value="">{{ connectHistoryOptions.length ? '— 选择历史设备 —' : '暂无历史连接' }}</option>
            <option v-for="h in connectHistoryOptions" :key="h.value" :value="h.value">{{ h.label }}</option>
          </select>
        </label>
        <label class="cf-row"><span>别名</span><input v-model="connectAlias" :disabled="connecting" placeholder="可选，非空且连接成功后作为设备显示名" /></label>
        <div v-if="connecting" class="connect-progress"><span class="busy-spinner"></span>正在连接 {{ connectIp }}:{{ connectPort || '5555' }}…<span class="connect-progress-tip">（点取消强行断开）</span></div>
        <div v-else-if="connectTimedOut" class="connect-timeout">连接超时（{{ CONNECT_TIMEOUT_MS / 1000 }} 秒）。请检查设备 IP/端口与网络，或稍后重试。</div>
      </div>
      <div class="modal-foot">
        <button @click="onCancelClick">{{ connecting ? '取消连接' : '取消' }}</button>
        <button class="primary" :disabled="connecting" @click="confirmConnect">{{ connecting ? '连接中…' : '确认' }}</button>
      </div>
    </div>
  </div>
</template>
