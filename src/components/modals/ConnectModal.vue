<script setup>
// 连接设备弹窗（adb connect ip:port，可选别名 + 成功历史回填 + 连接中/超时提示）
import { computed } from 'vue'
import * as State from '@/composables/state'
import AppSelect from '../AppSelect.vue'
import { maskClose } from '@/composables/useConfig'
import { applyConnectHistory, cancelConnect, confirmConnect } from '@/composables/useDevices'
import { t } from '@/i18n'

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
      <div class="modal-head">{{ t('menu.connectDevice') }} <button class="modal-x" @click="onCancelClick">×</button></div>
      <div class="modal-body connect-body">
        <label class="cf-row"><span>IP</span><input v-model="connectIp" :disabled="connecting" :placeholder="t('connect.ipPlaceholder')" /></label>
        <label class="cf-row"><span>{{ t('connect.port') }}</span><input v-model="connectPort" :disabled="connecting" :placeholder="t('connect.portHint')" /></label>
        <label class="cf-row">
          <span>{{ t('common.history') }}</span>
          <AppSelect v-model="connectHistorySel" :disabled="connecting || !connectHistoryOptions.length" @change="applyConnectHistory"
                     :placeholder="connectHistoryOptions.length ? t('connect.selectHistory') : t('connect.noHistory')"
                     :options="[{ value: '', label: connectHistoryOptions.length ? t('connect.selectHistory') : t('connect.noHistory') }, ...connectHistoryOptions]" />
        </label>
        <label class="cf-row"><span>{{ t('common.alias') }}</span><input v-model="connectAlias" :disabled="connecting" :placeholder="t('connect.aliasHint')" /></label>
        <div v-if="connecting" class="connect-progress"><span class="busy-spinner"></span>{{ t('connect.inProgress', { ip: connectIp, port: connectPort || '5555' }) }}<span class="connect-progress-tip">{{ t('connect.cancelHint') }}</span></div>
        <div v-else-if="connectTimedOut" class="connect-timeout">{{ t('connect.timeout', { sec: CONNECT_TIMEOUT_MS / 1000 }) }}</div>
      </div>
      <div class="modal-foot">
        <button @click="onCancelClick">{{ connecting ? t('connect.cancelConnecting') : t('common.cancel') }}</button>
        <button class="primary" :disabled="connecting" @click="confirmConnect">{{ connecting ? t('connect.connecting') : t('common.confirm') }}</button>
      </div>
    </div>
  </div>
</template>
