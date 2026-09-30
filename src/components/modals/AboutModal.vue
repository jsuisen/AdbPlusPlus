<script setup>
// 关于弹窗：版本/运行环境元信息运行时取自主进程（app:meta），以 package.json semver 为单一事实来源
import { ref, onMounted } from 'vue'
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { APP_META } from '@shared/ipc-channels.js'
import { REPO_URL } from '@shared/version.js'
import { useUpdate } from '@/composables/useUpdate'

const { aboutOpen } = State
const { manualCheck } = useUpdate()
const meta = ref(null)
onMounted(async () => {
  try { meta.value = await window.api.invoke(APP_META) } catch { meta.value = null }
})
</script>

<template>
  <div v-if="aboutOpen" class="modal-mask" @click.self="maskClose(() => aboutOpen = false)">
    <div class="modal">
      <div class="modal-head">
        ADB++
        <button class="modal-x" @click="aboutOpen = false">×</button>
      </div>
      <div class="modal-body">
        <p>ADB++，工程级ADB桌面工具</p>
        <p>版本: {{ meta ? meta.version : '…' }}</p>
        <p>Electron: {{ meta ? meta.electron : '…' }}</p>
        <p>Chrome: {{ meta ? meta.chrome : '…' }}</p>
        <p>Node.js: {{ meta ? meta.node : '…' }}</p>
        <p>Vue 3 + Vite</p>
        <p class="muted">✉️saysawgames@qq.com</p>
        <p class="muted">🏠{{ REPO_URL }}</p>
      </div>
      <div class="modal-foot"><button @click="manualCheck">版本检测</button><button class="primary" @click="aboutOpen = false">关闭</button></div>
    </div>
  </div>
</template>
