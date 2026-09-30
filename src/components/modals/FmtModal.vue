<script setup>
// 日志格式弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { cancelFmt, confirmFmt } from '@/composables/useLogcat'

const { fmtModalOpen, fmtDraft, exampleText } = State
</script>

<template>
  <div v-if="fmtModalOpen" class="modal-mask" @click.self="maskClose(cancelFmt)">
    <div class="modal">
      <div class="modal-head">
        日志格式
        <button class="modal-x" @click="cancelFmt">×</button>
      </div>
      <div class="modal-body">
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.date" /> 是否展示日期和时间（如 2018-02-07 06:16:28.555）</label>
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.pid" /> 是否展示进程与线程ID（如 123-456）</label>
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.pkg" /> 是否展示包名（如 com.android.sample）</label>
        <label class="fmt-row"><input type="checkbox" v-model="fmtDraft.tag" /> 是否展示 Tag（如 SampleTag）</label>
        <div class="fmt-example">
          <div class="fmt-example-label">示例内容</div>
          <input class="fmt-example-input" :value="exampleText" readonly />
        </div>
      </div>
      <div class="modal-foot">
        <button class="primary" @click="confirmFmt">确认</button>
        <button @click="cancelFmt">取消</button>
      </div>
    </div>
  </div>
</template>
