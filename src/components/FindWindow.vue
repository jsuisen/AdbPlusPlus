<script setup>
// 日志窗口查找对话框（布局参考 Notepad++「查找」）：浮动面板，可拖动/调宽，关闭即撤销全部高亮
import { nextTick } from 'vue'
import * as State from '@/composables/state'
import AppSelect from './AppSelect.vue'
import { closeFindWindow, stepFind, countFind, refreshFindScope, startFindDrag, startFindResize, onFindWinMouseDown } from '@/composables/useLogcat'
import { t } from '@/i18n'

const {
  findOpen, findEl, findTargetInput, findDraft, findHistory, findBox,
  findPatternError, findMatches, findSnap, findWinStyle
} = State

// 原生 datalist 的提示弹层由系统绘制且无法深色化；改为自绘历史下拉，选中后回填输入框。
function onFindHistoryPick(v) {
  if (typeof v !== 'string' || !v) return
  findDraft.target = v
  nextTick(() => { if (findTargetInput.value) findTargetInput.value.focus() })
}
</script>

<template>
  <!-- Teleport 到 body：脱离日志区 overflow 容器，避免浮动面板被裁剪 -->
  <Teleport to="body">
    <div v-if="findOpen" ref="findEl" class="find-win" tabindex="-1" :style="findWinStyle"
       @mousedown="onFindWinMouseDown">
    <div class="find-title" @mousedown="startFindDrag">
      <span>{{ t('common.search') }}</span>
      <button class="find-x" type="button" @click="closeFindWindow" :title="t('find.closeEsc')">✕</button>
    </div>
    <div class="find-body">
      <div class="find-row-target">
        <label class="find-label" for="find-target">{{ t('find.target') }}</label>
        <input id="find-target" ref="findTargetInput" class="find-input"
               v-model="findDraft.target" :placeholder="t('find.placeholder')" @keydown.enter.prevent="stepFind(1)" />
        <AppSelect class="find-history-select" style="width:72px; flex:none"
                   :placeholder="t('common.history')" :options="findHistory" @change="onFindHistoryPick" />
        <button class="find-btn find-prev" type="button" @click="stepFind(-1)" :title="t('find.prev')">▲</button>
        <button class="find-btn find-next" type="button" @click="stepFind(1)" :title="t('find.nextEnter')">{{ t('find.nextBtn') }}</button>
      </div>
      <div class="find-cols">
        <div class="find-col-left">
          <label class="find-chk"><input type="checkbox" v-model="findDraft.backward" /> {{ t('find.backward') }}</label>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.wholeWord" /> {{ t('find.wholeWord') }}</label>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.matchCase" /> {{ t('find.matchCase') }}</label>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.wrap" /> {{ t('find.wrap') }}</label>
          <fieldset class="find-fieldset">
            <legend>{{ t('find.mode') }}</legend>
            <label class="find-chk"><input type="radio" value="normal" v-model="findDraft.mode" /> {{ t('find.normal') }}</label>
            <label class="find-chk"><input type="radio" value="regex" v-model="findDraft.mode" /> {{ t('find.regex') }}</label>
            <label class="find-chk find-dotall"><input type="checkbox" v-model="findDraft.dotAll" :disabled="findDraft.mode !== 'regex'" /> {{ t('find.dotAll') }}</label>
          </fieldset>
        </div>
        <div class="find-col-right">
          <button class="find-btn find-count" type="button" @click="countFind" :title="t('find.countHint')">{{ t('find.countBtn') }}</button>
          <div class="find-result" v-if="findBox">{{ findBox }}</div>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.transparent" /> {{ t('find.opacity') }}</label>
          <fieldset class="find-fieldset find-trans">
            <label class="find-chk"><input type="radio" value="blur" v-model="findDraft.transMode" :disabled="!findDraft.transparent" /> {{ t('find.afterBlur') }}</label>
            <label class="find-chk"><input type="radio" value="always" v-model="findDraft.transMode" :disabled="!findDraft.transparent" /> {{ t('find.always') }}</label>
            <input class="find-slider" type="range" min="20" max="100" step="1" v-model.number="findDraft.transValue" :disabled="!findDraft.transparent" />
          </fieldset>
        </div>
      </div>
    </div>
    <div class="find-status">
      <span v-if="findPatternError" class="find-err">{{ findPatternError }}</span>
      <span v-else class="find-num">{{ t('find.count', { n: findMatches.length }) }}</span>
      <span class="find-scope">{{ t('find.scope', { n: findSnap ? findSnap.lines.length : 0, s: findSnap && findSnap.serial ? ' · ' + findSnap.serial : '' }) }}</span>
      <button class="find-refresh" type="button" @click="refreshFindScope" :title="t('find.rescopeHint')">{{ t('find.rescope') }}</button>
    </div>
    <!-- 仅左右边缘可拖拽改宽度（高度按内容固定，不可调） -->
    <div class="find-rsz e" @mousedown="startFindResize($event,'e')"></div>
    <div class="find-rsz w" @mousedown="startFindResize($event,'w')"></div>
    </div>
  </Teleport>
</template>
