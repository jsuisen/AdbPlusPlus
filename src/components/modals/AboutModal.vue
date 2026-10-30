<script setup>
// 关于弹窗：版本/运行环境元信息运行时取自主进程（app:meta），以 package.json semver 为单一事实来源
import { ref, onMounted } from 'vue'
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { APP_META } from '@shared/ipc-channels.js'
import { REPO_URL } from '@shared/version.js'
import { useUpdate } from '@/composables/useUpdate'
// 支付宝图片：放工程 resources/ 下，经 Vite 打包进 dist/assets（asar 内可访问）
import alipayImg from '../../../resources/alipay.jpg'

const { aboutOpen } = State
const { manualCheck } = useUpdate()
const meta = ref(null)
onMounted(async () => {
  try { meta.value = await window.api.invoke(APP_META) } catch { meta.value = null }
})
</script>

<template>
  <div v-if="aboutOpen" class="modal-mask" @click.self="maskClose(() => aboutOpen = false)">
    <div class="modal about-modal">
      <!-- 图片层级低于文字：z-index:0，文字层（head/body/foot）z-index:1 压在其上，允许部分遮挡 -->
      <img class="about-img" :src="alipayImg" alt="alipay" draggable="false" />
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

<style scoped>
/* 关于弹窗加宽，给右侧图片留空间；作为图片绝对定位的锚点 */
.modal.about-modal { position: relative; width: 520px; }
/* 图片：右侧绝对定位，z-index 低于文字层 */
.about-img {
  position: absolute;
  right: 40px;
  top: 42%;
  transform: translateY(-50%);
  width: 200px;
  max-height: 78%;
  object-fit: contain;
  z-index: 0;
  border-radius: 8px;
  pointer-events: none;
  opacity: 0.96;
}
/* 文字层（标题/正文/页脚）提权到 z-index:1，压在图片之上，允许部分遮挡图片 */
.about-modal .modal-head,
.about-modal .modal-body,
.about-modal .modal-foot { position: relative; z-index: 1; }
/* 正文留出右侧图片宽度，避免文字与图片重叠过多导致不可读（重叠处文字仍在上层） */
.about-modal .modal-body { padding-right: 220px; }
</style>
