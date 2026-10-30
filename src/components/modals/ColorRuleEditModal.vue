<script setup>
// 关键字上色：新增 / 修改 规则弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { onDraftHexInput, onDraftBgInput, saveColorRule, deleteColorRule } from '@/composables/useColorrules'

const { colorModalOpen, colorModalEditId, colorDraft, colorDraftErr } = State
</script>

<template>
  <div v-if="colorModalOpen" class="modal-mask color-rule-mask" @click.self="maskClose(() => colorModalOpen = false)">
    <div class="modal color-rule-modal">
      <div class="modal-head">
        {{ colorModalEditId != null ? '修改规则' : '新增规则' }}
        <button class="modal-x" @click="colorModalOpen = false">×</button>
      </div>
      <div class="modal-body">
        <div class="cr-row"><span class="cr-label">关键字</span><input type="text" v-model="colorDraft.keyword" placeholder="用于匹配的关键字" spellcheck="false" /></div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.byTag" /><span>匹配 Tag（同窗口「Tag 过滤」：Tag 包含该关键字）</span></div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.byMsg" /><span>匹配日志内容（同窗口「关键字过滤」：内容包含该关键字）</span></div>
        <div class="cr-row cr-color">
          <span class="cr-label">文本色</span>
          <input type="color" v-model="colorDraft.color" :disabled="!colorDraft.bgOn" />
          <input type="text" class="color-hex-input" :value="colorDraft.color" :disabled="!colorDraft.bgOn" @input="onDraftHexInput($event.target.value)" maxlength="7" spellcheck="false" />
        </div>
        <div class="cr-row cr-color">
          <span class="cr-label">背景色</span>
          <input type="color" v-model="colorDraft.bgColor" :disabled="!colorDraft.bgOn" />
          <input type="text" class="color-hex-input" :value="colorDraft.bgColor" :disabled="!colorDraft.bgOn" @input="onDraftBgInput($event.target.value)" maxlength="7" spellcheck="false" />
        </div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.bold" /><span>加粗显示</span></div>
        <div class="switch-row"><input type="checkbox" v-model="colorDraft.bgOn" /><span>启用</span></div>
        <p v-if="colorDraftErr" class="muted small" style="color:var(--danger)">{{ colorDraftErr }}</p>
      </div>
      <div class="modal-foot">
        <button v-if="colorModalEditId != null" class="danger" @click="deleteColorRule">删除</button>
        <button @click="colorModalOpen = false">取消</button>
        <button class="primary" @click="saveColorRule">保存</button>
      </div>
    </div>
  </div>
</template>
