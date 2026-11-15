<script setup>
// 统一结果弹窗：所有原本写进状态栏的成功/失败文本改在这里展示。
// 正文用 <pre> 渲染，user-select:text，可手动拖选，也可点「复制文本」一键复制。
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { toast } from '@/composables/useUi'

const { api, closeResult, resultOk, resultOpen, resultText, resultTitle } = State

async function copyResult() {
  const text = (resultTitle.value || '操作结果') + '\n' + (resultText.value || '')
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text)
    else await api.invoke('clipboard:write', { text })
    toast('已复制结果文本')
  } catch {
    // 渲染进程 clipboard API 不可用时回落到主进程通道（主进程 handler 自行吞异常）
    try { await api.invoke('clipboard:write', { text }); toast('已复制结果文本') }
    catch { toast('复制失败，请手动选中文本复制') }
  }
}
</script>

<template>
  <div v-if="resultOpen" class="modal-mask result-mask" @click.self="maskClose(closeResult)">
    <div class="modal result-modal">
      <div class="modal-head">
        操作结果
        <button class="modal-x" @click="closeResult">×</button>
      </div>
      <div class="modal-body">
        <div class="result-title" :class="resultOk ? 'result-ok' : 'result-fail'">
          <span class="result-badge">{{ resultOk ? '成功' : '失败' }}</span>
          <span class="result-name">{{ resultTitle }}</span>
        </div>
        <pre class="result-text">{{ resultText }}</pre>
        <div class="result-tip muted">正文可选中复制；点「复制文本」可复制完整结果。</div>
      </div>
      <div class="modal-foot">
        <button @click="copyResult">复制文本</button>
        <button class="primary" @click="closeResult">关闭</button>
      </div>
    </div>
  </div>
</template>
