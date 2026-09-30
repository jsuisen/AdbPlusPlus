<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as State from './composables/state'
import { useDevices } from './composables/useDevices'
import { useConfig } from './composables/useConfig'
import { useApk } from './composables/useApk'
import { useMedia } from './composables/useMedia'
import { useLogcat } from './composables/useLogcat'
import { useActions } from './composables/useActions'
import { useDeviceinfo } from './composables/useDeviceinfo'
import { useUi } from './composables/useUi'
import { useColorrules } from './composables/useColorrules'
import { useApp } from './composables/useApp'
import { useUpdate } from './composables/useUpdate'
import PollingListTab from './components/PollingListTab.vue'
import AboutModal from './components/modals/AboutModal.vue'
import ApkModal from './components/modals/ApkModal.vue'
import FmtModal from './components/modals/FmtModal.vue'
import QuickFilterModal from './components/modals/QuickFilterModal.vue'
import ColorRuleEditModal from './components/modals/ColorRuleEditModal.vue'
import ContentColorWindow from './components/modals/ContentColorWindow.vue'
import CmdOutputModal from './components/modals/CmdOutputModal.vue'
import SettingsModal from './components/modals/SettingsModal.vue'
import CaptureManagerModal from './components/modals/CaptureManagerModal.vue'
import ConnectModal from './components/modals/ConnectModal.vue'
import DeviceCtxMenu from './components/DeviceCtxMenu.vue'
import RenameModal from './components/modals/RenameModal.vue'
import KeyModal from './components/modals/KeyModal.vue'
import KeyRefModal from './components/modals/KeyRefModal.vue'
import InputModal from './components/modals/InputModal.vue'
import ActModal from './components/modals/ActModal.vue'
import PermModal from './components/modals/PermModal.vue'
import FileModal from './components/modals/FileModal.vue'
import RebootModal from './components/modals/RebootModal.vue'
import MonkeyModal from './components/modals/MonkeyModal.vue'
import InstallModal from './components/modals/InstallModal.vue'
import UninstallModal from './components/modals/UninstallModal.vue'
import UpdateModal from './components/modals/UpdateModal.vue'
import FindWindow from './components/FindWindow.vue'

const { COLOR_PRESETS, aboutOpen, activeLogSerial, activeMainTab, activityAuto, activityFilter, activityInterval, activityList, activityListFiltered, activityLoading, activityRunning, appPkg, autoscroll, capturing, cmdGroup, cmdGroups, cmdOutput, collapsedSidebar, colorEditIndex, ctxMenu, currentLogErr, currentRunning, devGroups, deviceInfo, deviceInfoLoading, devices, displayCmds, dumpsysOut, dumpsysService, editingNoteId, fmtMB, fmtRss, getpropFilter, getpropList, getpropListFiltered, getpropLoading, groupOpen, lastMsg, levelFilter, logEl, logFontStyle, managing, maximized, mergedView, newCmdArgs, newCmdGroup, newCmdIgnore, newCmdName, processAuto, processFilter, processInterval, processList, processListFiltered, processLoading, processRunning, procs, quickCommands, recording, regexFilter, runningMap, screenshotting, selectedProc, selectedSerial, serviceAuto, serviceFilter, serviceInterval, serviceList, serviceListFiltered, serviceLoading, serviceRunning, settingsOpen, tagFilter, textFilter, threadAuto, threadFilter, threadInterval, threadList, threadListFiltered, threadLoading, threadRunning, toastMsg, toastShow, updateInfo, wrapLines } = State
const { collapseAll, disconnectDevice, displayName, expandAll, loadDeviceFromFile, openConnectModal, openDeviceMenu, refreshDevices, runAction, selectDevice, toggleGroup } = useDevices()
const { saveCfg } = useConfig()
const { parseLocal } = useApk()

const { clearKeywordFilter, clearLogs, clearTagFilter, closeCtxMenu, commitNote, copySelection, editNote, exportLogs, findSegsFor, formatLogLine, onLogContextMenu, onLogKey, onLogMouseDown, onLogScrollSave, onNoteInput, onNoteKey, onWheel, openFindFromCtx, openFindWindow, openFmt, openQuickFilter, refreshProcs, scrollToTop, selectAllLogs, toggleLatest, toggleLogcat } = useLogcat()
// 日志区点击光标：纯视觉闪烁光标，落在点击处；同时放置一个真实折叠选区，
// 使浏览器原生 Shift+方向键 能从该点扩展文本选区（跨行/换行均有效）
const logCaret = reactive({ visible: false, x: 0, y: 0 })
// 跨浏览器取点击处的文本坐标，返回折叠 Range（无文本处返回 null）
function caretRangeFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y)
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y)
    if (!p) return null
    const r = document.createRange()
    r.setStart(p.offsetNode, p.offset)
    r.collapse(true)
    return r
  }
  return null
}
function onLogClick(ev) {
  const el = logEl.value
  if (!el) return
  // 鼠标拖拽（或双击/三击）选完文本后，浏览器仍会派发 click；此时选区是非折叠的，
  // 若继续按「单击定位光标」处理会把它折叠掉，用户刚选中的文本随之消失、无法复制 —— 直接返回，原样保留选区
  const cur = window.getSelection()
  if (cur && !cur.isCollapsed) { logCaret.visible = false; return }
  // 先确保日志区聚焦（方向键 keydown 才能被接收到）；聚焦后再放置选区，避免聚焦动作清掉刚放的折叠选区
  if (document.activeElement !== el) el.focus({ preventScroll: true })
  // 视觉光标：内容坐标系（扣边框、加滚动量），随内容滚动保持相对位置
  const rect = el.getBoundingClientRect()
  logCaret.x = ev.clientX - rect.left - el.clientLeft + el.scrollLeft
  logCaret.y = ev.clientY - rect.top - el.clientTop + el.scrollTop
  logCaret.visible = true
  // 放置真实折叠选区：作为 Shift+方向键（onLogKey 用 Selection.modify）扩展选区的起点
  const r = caretRangeFromPoint(ev.clientX, ev.clientY)
  if (r) {
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(r)
  }
}
// 由当前折叠选区（若落在日志区）推算视觉光标的内容坐标；非折叠/不在日志区/无矩形返回 null
function caretPixelPos() {
  const el = logEl.value
  if (!el) return null
  const rect = State.getCaretRect()
  if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) return null
  const er = el.getBoundingClientRect()
  return {
    x: rect.left - er.left - el.clientLeft + el.scrollLeft,
    y: rect.top - er.top - el.clientTop + el.scrollTop
  }
}
// 将视觉光标与日志区真实折叠选区对齐：折叠→显示并定位（点击 / 方向键移动 / 滚动后均保持贴合）；
// 扩展选区（Shift+方向键）→隐藏，避免与浏览器高亮重复；无选区 / 不在日志区→隐藏
function syncCaretFromSel() {
  const sel = window.getSelection()
  const el = logEl.value
  if (!sel || !el || !sel.anchorNode || !el.contains(sel.anchorNode)) {
    logCaret.visible = false
    return
  }
  if (sel.isCollapsed) {
    const pos = caretPixelPos()
    if (pos) { logCaret.x = pos.x; logCaret.y = pos.y; logCaret.visible = true }
    else logCaret.visible = false
  } else {
    logCaret.visible = false
  }
}
// 滚动后把视觉光标重新对齐到真实折叠选区（非可编辑容器下浏览器不会自动保持光标可见，
// 这里随内容滚动让光标始终贴合其所在文本）；无折叠选区（如拖动滚动条后失焦）则隐藏
function onLogScroll() {
  onLogScrollSave()
  syncCaretFromSel()
}
function onSelectionChange() {
  syncCaretFromSel()
}
onMounted(() => document.addEventListener('selectionchange', onSelectionChange))
onBeforeUnmount(() => document.removeEventListener('selectionchange', onSelectionChange))
const { addCmd, closeCmdOutput, cmdTextColor, onCmdArgsInput, onCmdColor, removeCmd, runCmd } = useActions()
const { exportDeviceInfo, exportGetprop, fetchGetprop, manualRefresh, runBugreport, runDumpsys, toggleDetect } = useDeviceinfo()
const { winClose, winMax, winMin } = useUi()
const { logLineStyle, openColorWin } = useColorrules()
useApp()
const { openUpdateDialog } = useUpdate()
</script>

<template>
  <div class="app-root" @wheel="onWheel">
    <!-- 菜单栏（已合并自定义标题栏：左侧 收起/关于，右侧 窗口控制） -->
    <div class="menubar">
      <div class="menu-left">
        <button @click="collapsedSidebar = !collapsedSidebar">{{ collapsedSidebar ? '展开侧边栏' : '收起侧边栏' }}</button>
        <button @click="openConnectModal">连接设备</button>
        <button @click="loadDeviceFromFile">加载设备</button>
        <button @click="refreshDevices">刷新设备</button>
        <button @click="parseLocal">解析本地APK</button>
        <button @click="settingsOpen = true">设置</button>
        <button @click="aboutOpen = true">关于</button>
      </div>
      <div class="win-ctl">
        <button @click="winMin" title="最小化">–</button>
        <button @click="winMax" :title="maximized ? '还原' : '最大化'">{{ maximized ? '❐' : '▢' }}</button>
        <button class="win-close" @click="winClose" title="关闭">✕</button>
      </div>
    </div>

    <div class="body">
      <!-- 侧边栏：设备管理（设备列表，多设备并行） -->
      <aside class="sidebar" :class="{ collapsed: collapsedSidebar }">
        <div class="side-scroll">
          <div class="dev-mgmt">
            <div class="dev-head">
              <span>设备管理</span>
              <div class="dev-head-btns">
                <button @click="expandAll">全部展开</button>
                <button @click="collapseAll">全部收起</button>
              </div>
            </div>
            <div class="dev-list">
              <div v-if="!devices.length" class="dev-empty muted">（无设备）</div>
              <div v-for="d in devices" :key="d.serial" class="dev-item" :class="{ active: d.serial === selectedSerial }" @click="selectDevice(d.serial)" @contextmenu.prevent="openDeviceMenu(d, $event)">
                <div class="dev-meta">
                  <span class="dev-serial">{{ displayName(d.serial) }}</span>
                  <span class="dev-status" :class="{ off: d.status !== 'device' }">{{ d.status }}</span>
                </div>
                <div class="dev-acts" @click.stop>
                  <button class="dev-disc" title="断开设备" @click="disconnectDevice(d.serial)">×</button>
                </div>
              </div>
            </div>
            <div v-for="g in devGroups" :key="g.key" class="sgroup">
              <div class="sg-head" @click="toggleGroup(g.key)">
                <span class="caret">{{ groupOpen[g.key] ? '▾' : '▸' }}</span>{{ g.title }}
              </div>
              <div v-show="groupOpen[g.key]" class="sg-body">
                <template v-for="(it, i) in g.items" :key="it.act || it.kind || i">
                  <!-- 应用包名输入框（仅 应用操作 分组内含） -->
                  <label v-if="it.kind === 'pkg'" class="pkg-row">应用包名
                    <input v-model="appPkg" placeholder="如 com.example.app" @change="saveCfg" />
                  </label>
                  <button v-else :class="['sbtn', {
                    primary: (it.act === 'recordStart' && !recording) || (it.act === 'screenshotTimer' && !screenshotting),
                    danger: (it.act === 'recordStart' && recording) || (it.act === 'screenshotTimer' && screenshotting) || it.danger
                  }]"
                    :disabled="(!selectedSerial && !it.server) || (it.needProc && !selectedProc) || (it.needPkg && !appPkg)"
                    @click="runAction(it)">
                    {{ (it.act === 'recordStart' && recording) ? '停止录屏' : (it.act === 'screenshotTimer' && screenshotting) ? '停止截图' : (it.act === 'captureToggle' && capturing[selectedSerial]) ? '停止抓包' : it.label }}
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 功能区：日志窗口（按设备分 tab） -->
      <main class="main">
        <div class="areatabs">
          <button :class="{ active: activeMainTab === 'log' }" @click="activeMainTab = 'log'">日志</button>
          <button :class="{ active: activeMainTab === 'info' }" @click="activeMainTab = 'info'">设备信息</button>
          <button :class="{ active: activeMainTab === 'activity' }" @click="activeMainTab = 'activity'">前台Activity</button>
          <button :class="{ active: activeMainTab === 'service' }" @click="activeMainTab = 'service'">运行中的Service</button>
          <button :class="{ active: activeMainTab === 'process' }" @click="activeMainTab = 'process'">进程</button>
          <button :class="{ active: activeMainTab === 'thread' }" @click="activeMainTab = 'thread'">线程</button>
          <button :class="{ active: activeMainTab === 'getprop' }" @click="activeMainTab = 'getprop'">getprop</button>
        </div>
        <div v-if="activeMainTab === 'log'" class="logarea">
          <div class="logtabs">
            <button v-for="d in devices" :key="d.serial" class="logtab"
              :class="{ active: d.serial === activeLogSerial, on: runningMap[d.serial] }"
              @click="selectDevice(d.serial)">
              <span class="tab-name">{{ d.serial }}</span>
              <span v-if="runningMap[d.serial]" class="tab-dot"></span>
            </button>
            <span v-if="!devices.length" class="muted">无设备</span>
          </div>
          <div class="toolbar">
            <button :class="currentRunning ? 'danger' : 'primary'" @click="toggleLogcat">{{ currentRunning ? '停止' : '开始' }}</button>
            <select v-model="levelFilter">
              <option value="">级别</option>
                <option value="V">V</option><option value="D">D</option>
                <option value="I">I</option><option value="W">W</option>
                <option value="E">E</option><option value="F">F</option>
              </select>
            <span class="proc-wrap">
              <select v-model="selectedProc" :disabled="!activeLogSerial" style="max-width:200px" @mousedown="refreshProcs" title="点开即刷新当前设备进程列表">
                <option value="">-进程包名-</option>
                <option v-for="p in procs" :key="p.pid" :value="p.pkg">{{ p.pkg }}({{ p.pid }})</option>
              </select>
            </span>
            <span class="kwfilter-wrap tag-wrap">
              <input v-model="tagFilter" placeholder="Tag 过滤" />
              <button v-if="tagFilter" class="kw-clear" type="button" @click="clearTagFilter" title="清空 Tag 过滤">×</button>
            </span>
            <label><input type="checkbox" v-model="regexFilter" /> Regex</label>
            <span class="kwfilter-wrap">
              <input v-model="textFilter" placeholder="关键字过滤" />
              <button v-if="textFilter" class="kw-clear" type="button" @click="clearKeywordFilter" title="清空关键字过滤">×</button>
            </span>
            <button @click="openQuickFilter" title="按 Tag 快速筛选：勾选要显示的 Tag，自动生成正则过滤">快筛</button>
            <button @click="openColorWin" title="按关键字给日志行上色：全局规则 + 当前会话规则，本会话优先">颜色</button>
            <button @click="scrollToTop" title="跳转到日志顶部">顶部</button>
            <button :class="{ active: autoscroll }" @click="toggleLatest" title="蓝=跟随中：新日志始终滚到底部；再点一次关闭跟随；在日志窗口中点击或滚轮上滚也会取消">底部</button>
            <button :class="{ active: wrapLines }" @click="wrapLines = !wrapLines" title="开启后日志自动换行；关闭则始终不换行且支持水平滚动">换行</button>
            <button @click="clearLogs">清空</button>
            <button @click="openFindWindow" title="在当前日志窗口中查找（Ctrl+F）">搜索</button>
            <button @click="exportLogs">导出</button>
            <button @click="openFmt">格式</button>
            <span v-if="currentLogErr" class="muted" style="color:var(--danger)">{{ currentLogErr }}</span>
          </div>
          <div class="logview" :class="{ nowrap: !wrapLines }" :style="logFontStyle" ref="logEl" tabindex="-1" @keydown="onLogKey" @scroll="onLogScroll" @mousedown="onLogMouseDown" @contextmenu="onLogContextMenu($event)" @click="onLogClick">
            <div v-if="logCaret.visible" class="log-caret" :style="{ left: logCaret.x + 'px', top: logCaret.y + 'px' }"></div>
            <div v-if="!mergedView.length" class="muted">点击「开始」采集 {{ activeLogSerial || '设备' }} 的日志…</div>
            <template v-for="e in mergedView" :key="e.id">
              <div v-if="e.kind !== 'note'" class="logline" :style="logLineStyle(e)" :data-log-id="e.id"
                   title="单击只定位光标（不新增行）；按回车在日志末尾新增注释行">
                <template v-if="findSegsFor(e)">
                  <span v-for="(s, i) in findSegsFor(e)" :key="i" :class="{ 'find-hit': s.hit, 'find-cur': s.cur }">{{ s.t }}</span>
                </template>
                <template v-else>{{ formatLogLine(e) }}</template>
              </div>
              <div v-else class="note-line" :class="{ editing: e.id === editingNoteId }" :data-log-id="e.id" @click="editNote(e)">
                <span v-if="e.id !== editingNoteId" class="note-text" title="单击编辑此注释 / 空行（Enter 换行，Esc 取消）">
                  <template v-if="findSegsFor(e)">
                    <span v-for="(s, i) in findSegsFor(e)" :key="i" :class="{ 'find-hit': s.hit, 'find-cur': s.cur }">{{ s.t }}</span>
                  </template>
                  <template v-else>{{ e.text }}</template>
                </span>
                <textarea v-else :data-note-input="e.id" class="note-input" rows="1" v-model="e.text"
                          @keydown.stop="onNoteKey($event, e)" @input="onNoteInput($event, e)" @blur="commitNote(e)"></textarea>
              </div>
            </template>
            <div class="logview-tail" title="按回车在日志末尾新增注释行（此处仅供点击定位光标）"></div>
          </div>
          <!-- 右键菜单：Teleport 到 body，彻底脱离日志区 overflow 容器，避免被裁剪看不见 -->
          <Teleport to="body">
            <div v-if="ctxMenu.visible" class="ctx-overlay" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu">
              <div class="ctx-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
                <button class="ctx-item" :disabled="!ctxMenu.text" @click="copySelection">复制</button>
                <button class="ctx-item" @click="selectAllLogs">全选</button>
                <button class="ctx-item" @click="openFindFromCtx">搜索</button>
              </div>
            </div>
          </Teleport>
          <!-- 查找窗口：布局参考 Notepad++「查找」对话框；浮动面板（非遮罩），不挡住日志区的滚动与右键操作 -->
          <FindWindow />
        </div>
        <div v-else-if="activeMainTab === 'info'" class="infoarea">
          <div class="info-toolbar">
            <button :disabled="deviceInfoLoading || !Object.keys(deviceInfo).length" @click="exportDeviceInfo">导出</button>
          </div>
          <div v-if="deviceInfoLoading" class="muted">获取设备信息中…</div>
          <template v-else>
            <div class="info-grid">
              <div class="info-card"><div class="info-label">名称</div><div class="info-val">{{ displayName(selectedSerial) }}</div></div>
              <div class="info-card"><div class="info-label">型号</div><div class="info-val">{{ deviceInfo.model }}</div></div>
              <div class="info-card"><div class="info-label">Android 版本</div><div class="info-val">{{ deviceInfo.androidVersion }}</div></div>
              <div class="info-card"><div class="info-label">分辨率</div><div class="info-val">{{ deviceInfo.resolution }}</div></div>
              <div class="info-card"><div class="info-label">密度</div><div class="info-val">{{ deviceInfo.density }}</div></div>
              <div class="info-card"><div class="info-label">内存(总量)</div><div class="info-val">{{ deviceInfo.memTotal }}</div></div>
              <div class="info-card"><div class="info-label">内存(可用)</div><div class="info-val">{{ deviceInfo.memAvailable }}</div></div>
              <div class="info-card"><div class="info-label">存储(可用/总量)</div><div class="info-val">{{ deviceInfo.storage }}</div></div>
              <div class="info-card"><div class="info-label">CPU</div><div class="info-val">{{ deviceInfo.cpu }}</div></div>
              <div class="info-card"><div class="info-label">android_id</div><div class="info-val">{{ deviceInfo.androidId }}</div></div>
              <div class="info-card"><div class="info-label">stbid</div><div class="info-val">{{ deviceInfo.stbId }}</div></div>
              <div class="info-card"><div class="info-label">oid</div><div class="info-val">{{ deviceInfo.oid }}</div></div>
            </div>
            <div class="info-block">
              <div class="info-label">前台 Activity</div>
              <code class="info-code">{{ deviceInfo.foregroundActivity }}</code>
            </div>
            <div class="info-block">
              <div class="info-label">MAC（多网卡）</div>
              <div class="mac-list">
                <code v-for="m in (deviceInfo.macs || [])" :key="m" class="info-code">{{ m }}</code>
              </div>
              <div v-if="!(deviceInfo.macs && deviceInfo.macs.length)" class="muted">—</div>
            </div>
            <div class="info-block">
              <div class="info-label">dumpsys 查询</div>
              <div class="row">
                <input v-model="dumpsysService" placeholder="service，如 meminfo / battery / activity / window" style="flex:1" />
                <button class="primary" @click="runDumpsys">执行</button>
                <button @click="runBugreport">bugreport</button>
              </div>
              <pre v-if="dumpsysOut" class="dumpsys-out">{{ dumpsysOut }}</pre>
            </div>
          </template>
        </div>
        <PollingListTab v-else-if="activeMainTab === 'activity'"
          v-model:filter="activityFilter" v-model:auto="activityAuto" v-model:interval="activityInterval"
          :running="activityRunning" :loading="activityLoading"
          label="前台 Activity" loading-text="获取前台 Activity 列表中…" empty-text="前台 Activity"
          :count="activityList.length" :matched="activityListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('activity')" @refresh="manualRefresh('activity')">
          <div v-for="a in activityListFiltered" :key="a.name" class="svc-item">
            <span class="svc-name">{{ a.name }}</span>
            <span v-if="a.foreground" class="fg-badge">前台</span>
          </div>
          <div v-if="!activityListFiltered.length" class="muted">无</div>
        </PollingListTab>
        <PollingListTab v-else-if="activeMainTab === 'service'"
          v-model:filter="serviceFilter" v-model:auto="serviceAuto" v-model:interval="serviceInterval"
          :running="serviceRunning" :loading="serviceLoading"
          label="运行中的 Service" loading-text="获取 Service 列表中…" empty-text="运行中 Service"
          :count="serviceList.length" :matched="serviceListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('service')" @refresh="manualRefresh('service')">
          <div v-for="s in serviceListFiltered" :key="s" class="svc-item">{{ s }}</div>
          <div v-if="!serviceListFiltered.length" class="muted">无</div>
        </PollingListTab>
        <PollingListTab v-else-if="activeMainTab === 'process'"
          v-model:filter="processFilter" v-model:auto="processAuto" v-model:interval="processInterval"
          :running="processRunning" :loading="processLoading"
          label="当前系统中运行的进程" loading-text="获取进程列表中…" empty-text="进程与资源占用"
          :count="processList.length" :matched="processListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('process')" @refresh="manualRefresh('process')">
          <table v-if="processListFiltered.length" class="svc-table">
            <thead><tr>
              <th class="col-pid">PID</th><th class="col-name">NAME</th>
              <th class="col-num">CPU%</th><th class="col-num">RSS(MB)</th><th class="col-num">VSZ(MB)</th>
              <th class="col-num">线程</th><th class="col-state">状态</th><th class="col-num">读(MB)</th><th class="col-num">写(MB)</th>
            </tr></thead>
            <tbody>
              <tr v-for="p in processListFiltered" :key="p.pid + '-' + p.name">
                <td class="col-pid">{{ p.pid }}</td><td class="col-name" :title="p.name">{{ p.name }}</td>
                <td class="col-num">{{ p.cpu.toFixed(1) }}</td>
                <td class="col-num">{{ fmtRss(p.rss) }}</td>
                <td class="col-num">{{ fmtMB(p.vsize) }}</td>
                <td class="col-num">{{ p.threads }}</td>
                <td class="col-state">{{ p.state }}</td>
                <td class="col-num">{{ fmtMB(p.ioRead) }}</td>
                <td class="col-num">{{ fmtMB(p.ioWrite) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="muted">无</div>
        </PollingListTab>
        <PollingListTab v-else-if="activeMainTab === 'thread'"
          v-model:filter="threadFilter" v-model:auto="threadAuto" v-model:interval="threadInterval"
          :running="threadRunning" :loading="threadLoading"
          label="当前系统中运行的线程" loading-text="获取线程列表中…" empty-text="线程与 CPU 占用"
          :count="threadList.length" :matched="threadListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('thread')" @refresh="manualRefresh('thread')">
          <table v-if="threadListFiltered.length" class="svc-table">
            <thead><tr><th class="col-user">USER</th><th class="col-pid">PID</th><th class="col-tid">TID</th><th class="col-name">NAME</th><th class="col-num">CPU%</th><th class="col-state">状态</th></tr></thead>
            <tbody>
              <tr v-for="t in threadListFiltered" :key="t.pid + '-' + t.tid + '-' + t.name">
                <td class="col-user">{{ t.user }}</td><td class="col-pid">{{ t.pid }}</td><td class="col-tid">{{ t.tid }}</td><td class="col-name" :title="t.name">{{ t.name }}</td>
                <td class="col-num">{{ t.cpu.toFixed(1) }}</td><td class="col-state">{{ t.state }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="muted">无</div>
        </PollingListTab>
        <div v-else-if="activeMainTab === 'getprop'" class="listarea">
          <div class="list-toolbar">
            <input class="list-filter" v-model="getpropFilter" placeholder="过滤 key / value（共 {{ getpropList.length }} 条）" />
            <button :disabled="getpropLoading" @click="fetchGetprop()">刷新</button>
            <button :disabled="getpropLoading || !getpropList.length" @click="exportGetprop">导出</button>
          </div>
          <div v-if="getpropLoading" class="muted">获取 getprop 中…</div>
          <div v-else class="info-block">
            <div class="info-label">系统属性 getprop（共 {{ getpropList.length }} 条{{ getpropFilter ? '，匹配 ' + getpropListFiltered.length : '' }}）</div>
            <div class="svc-list">
              <div v-for="p in getpropListFiltered" :key="p.key" class="prop-item">
                <span class="prop-key">{{ p.key }}</span>
                <span class="prop-val">{{ p.value || '—' }}</span>
              </div>
              <div v-if="!getpropListFiltered.length" class="muted">无</div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 快捷按钮区（状态栏上一行、设备管理/日志窗口下一行） -->
    <div class="quickbar">
      <div class="qb-head">
        <span class="qb-title">快捷按钮</span>
        <select v-model="cmdGroup" class="qb-group">
          <option value="全部">全部分组</option>
          <option v-for="gp in cmdGroups" :key="gp" :value="gp">{{ gp }}</option>
        </select>
        <button class="qb-manage" @click="managing = !managing">{{ managing ? '完成' : '管理' }}</button>
        <button class="qb-close" @click="closeCmdOutput" title="关闭执行结果">✕</button>
      </div>
      <div class="qb-buttons">
        <button v-for="(c, i) in displayCmds" :key="i" class="qbtn" :style="{ background: c.color || '', color: cmdTextColor(c.color) }" @click="runCmd(c)">{{ c.name }}</button>
        <span v-if="!displayCmds.length" class="muted">暂无快捷命令，点「管理」添加（参数经主进程 spawn，不拼 shell）。</span>
      </div>
      <div v-if="managing" class="qb-edit">
        <div class="row">
          <input v-model="newCmdName" placeholder="命令名" style="width:140px" />
          <input v-model="newCmdArgs" placeholder="adb 参数，空格分隔" style="flex:1" />
            <input v-model="newCmdGroup" placeholder="分组(可选)" style="width:110px" />
            <label class="chk"><input type="checkbox" v-model="newCmdIgnore" /> 忽略响应</label>
            <button class="primary" @click="addCmd">添加</button>
        </div>
        <div class="cmdlist">
          <div v-for="(c, i) in quickCommands" :key="i" class="cmditem">
            <input class="ci-name" v-model="c.name" @change="saveCfg" placeholder="命令名" />
            <input class="ci-args" :value="c.args.join(' ')" @input="onCmdArgsInput(i, $event.target.value)" placeholder="adb 参数" />
            <input class="ci-group" v-model="c.group" @change="saveCfg" placeholder="分组" />
            <button class="ci-color" @click="colorEditIndex = (colorEditIndex === i ? null : i)">颜色</button>
            <button class="ci-del" @click="removeCmd(i)">删除</button>
            <label class="chk"><input type="checkbox" v-model="c.ignoreResponse" @change="saveCfg" /> 忽略响应</label>
            <div v-if="colorEditIndex === i" class="color-pop">
              <input type="color" :value="c.color || '#4a90d9'" @input="onCmdColor(i, $event.target.value)" />
              <div class="swatches">
                <button v-for="sw in COLOR_PRESETS" :key="sw" :style="{ background: sw }" @click="onCmdColor(i, sw)" :title="sw"></button>
              </div>
              <button class="ci-ok" @click="colorEditIndex = null">完成</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="cmdOutput" class="output">{{ cmdOutput }}</div>
    </div>

    <!-- 状态栏 -->
    <div class="statusbar">
      <span class="status-dot" :class="selectedSerial ? 'dot-ok' : 'dot-idle'"></span>
      <span>{{ selectedSerial || '未连接' }}</span>
      <span class="sb-sep">|</span>
      <span>设备数 {{ devices.length }}</span>
      <span class="sb-sep">|</span>
      <span>当前：{{ activeLogSerial || '—' }}</span>
      <span class="sb-sep">|</span>
      <span v-if="updateInfo && updateInfo.hasUpdate" class="sb-update" style="color:#185FA5;cursor:pointer" @click="openUpdateDialog">发现新版本 v{{ updateInfo.latest }}</span>
      <span v-if="updateInfo && updateInfo.hasUpdate" class="sb-sep">|</span>
      <span class="sb-msg">{{ lastMsg }}</span>
    </div>

    <!-- 关于弹窗 -->
    <AboutModal />
    <UpdateModal />

    <!-- APK 解析弹窗 -->
    <ApkModal />

    <!-- 日志格式弹窗 -->
    <FmtModal />

    <!-- 快筛：Tag 快速过滤弹窗 -->
    <QuickFilterModal />

    <!-- 关键字上色：新增 / 修改 规则弹窗 -->
    <ColorRuleEditModal />

    <!-- 日志窗口「颜色」弹窗：全局规则 + 本会话规则，本会话优先 -->
    <ContentColorWindow />

    <!-- 命令输出弹窗 -->
    <CmdOutputModal />

    <!-- 设置面板 -->
    <SettingsModal />

    <!-- 抓包管理弹窗 -->
    <CaptureManagerModal />

    <!-- 连接设备弹窗 -->
    <ConnectModal />

    <!-- 设备右键菜单（保存 / 重命名） -->
    <DeviceCtxMenu />

    <!-- 重命名设备弹窗 -->
    <RenameModal />

    <!-- 模拟按键弹窗（布局仿快捷按钮：左上标题、右上分组下拉+管理、下方按键按钮） -->
    <KeyModal />

    <!-- 键值速查弹窗：KEYCODE 名称 ↔ 值对照表，支持搜索与复制 -->
    <KeyRefModal />

    <!-- 输入类动作弹窗（输入文本 / 模拟点击 / 模拟滑动，布局仿快捷按钮；值字段按类型不同） -->
    <InputModal />

    <!-- 组件调试弹窗：启动 Activity / Service / 广播 -->
    <ActModal />

    <!-- 权限弹窗 -->
    <PermModal />

    <!-- 文件传输弹窗 -->
    <FileModal />

    <!-- 重启设备弹窗 -->
    <RebootModal />

    <!-- Monkey 弹窗 -->
    <MonkeyModal />

    <!-- 安装 APK 弹窗 -->
    <InstallModal />

    <!-- 卸载应用弹窗 -->
    <UninstallModal />
    <!-- Toast -->
    <div v-if="toastShow" class="toast">{{ toastMsg }}</div>
  </div>
</template>
