<script setup>
// 日志窗口查找对话框（布局参考 Notepad++「查找」）：浮动面板，可拖动/调宽，关闭即撤销全部高亮
import * as State from '@/composables/state'
import { closeFindWindow, stepFind, countFind, refreshFindScope, startFindDrag, startFindResize, onFindWinMouseDown } from '@/composables/useLogcat'

const {
  findOpen, findEl, findTargetInput, findDraft, findHistory, findBox,
  findPatternError, findMatches, findSnap, findWinStyle
} = State
</script>

<template>
  <!-- Teleport 到 body：脱离日志区 overflow 容器，避免浮动面板被裁剪 -->
  <Teleport to="body">
    <div v-if="findOpen" ref="findEl" class="find-win" tabindex="-1" :style="findWinStyle"
       @mousedown="onFindWinMouseDown">
    <div class="find-title" @mousedown="startFindDrag">
      <span>查找</span>
      <button class="find-x" type="button" @click="closeFindWindow" title="关闭（Esc）">✕</button>
    </div>
    <div class="find-body">
      <div class="find-row-target">
        <label class="find-label" for="find-target">查找目标(F):</label>
        <input id="find-target" ref="findTargetInput" class="find-input" list="find-history"
               v-model="findDraft.target" placeholder="输入要查找的内容" @keydown.enter.prevent="stepFind(1)" />
        <datalist id="find-history">
          <option v-for="h in findHistory" :key="h" :value="h"></option>
        </datalist>
        <button class="find-btn find-prev" type="button" @click="stepFind(-1)" title="查找上一个">▲</button>
        <button class="find-btn find-next" type="button" @click="stepFind(1)" title="查找下一个（回车）">▼ 查找下一个(E)</button>
      </div>
      <div class="find-cols">
        <div class="find-col-left">
          <label class="find-chk"><input type="checkbox" v-model="findDraft.backward" /> 反向查找</label>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.wholeWord" /> 全词匹配(W)</label>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.matchCase" /> 匹配大小写(C)</label>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.wrap" /> 循环查找(P)</label>
          <fieldset class="find-fieldset">
            <legend>查找模式</legend>
            <label class="find-chk"><input type="radio" value="normal" v-model="findDraft.mode" /> 普通(N)</label>
            <label class="find-chk"><input type="radio" value="regex" v-model="findDraft.mode" /> 正则表达式(G)</label>
            <label class="find-chk find-dotall"><input type="checkbox" v-model="findDraft.dotAll" :disabled="findDraft.mode !== 'regex'" /> . 号匹配换行符</label>
          </fieldset>
        </div>
        <div class="find-col-right">
          <button class="find-btn find-count" type="button" @click="countFind" title="统计当前搜索范围内的匹配总数">计数(T)</button>
          <div class="find-result" v-if="findBox">{{ findBox }}</div>
          <label class="find-chk"><input type="checkbox" v-model="findDraft.transparent" /> 透明度(Y)</label>
          <fieldset class="find-fieldset find-trans">
            <label class="find-chk"><input type="radio" value="blur" v-model="findDraft.transMode" :disabled="!findDraft.transparent" /> 失去焦点后</label>
            <label class="find-chk"><input type="radio" value="always" v-model="findDraft.transMode" :disabled="!findDraft.transparent" /> 始终</label>
            <input class="find-slider" type="range" min="20" max="100" step="1" v-model.number="findDraft.transValue" :disabled="!findDraft.transparent" />
          </fieldset>
        </div>
      </div>
    </div>
    <div class="find-status">
      <span v-if="findPatternError" class="find-err">{{ findPatternError }}</span>
      <span v-else class="find-num">计数: {{ findMatches.length }} 次匹配</span>
      <span class="find-scope">范围：打开窗口时的日志（{{ findSnap ? findSnap.lines.length : 0 }} 行{{ findSnap && findSnap.serial ? ' · ' + findSnap.serial : '' }}）</span>
      <button class="find-refresh" type="button" @click="refreshFindScope" title="把搜索范围更新为「此刻」日志窗口中的日志">重取范围</button>
    </div>
    <!-- 仅左右边缘可拖拽改宽度（高度按内容固定，不可调） -->
    <div class="find-rsz e" @mousedown="startFindResize($event,'e')"></div>
    <div class="find-rsz w" @mousedown="startFindResize($event,'w')"></div>
    </div>
  </Teleport>
</template>
