<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t } from './i18n'
import { ALL_GROUPS, normalizeSidebarWidth } from './composables/state'
import AppSelect from './components/AppSelect.vue'
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
import { useBackground } from './composables/useBackground'
import { useUpdate } from './composables/useUpdate'
import { useDeviceClock } from './composables/useDeviceClock'
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
import OfflineLogModal from './components/modals/OfflineLogModal.vue'
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
import ResultModal from './components/modals/ResultModal.vue'
import BusyIndicator from './components/BusyIndicator.vue'
import FindWindow from './components/FindWindow.vue'
// 日志窗口左侧竖条：AS Logcat 原版图标（?raw 内联，使 currentColor 跟随按钮 color，
// 「底部」「换行」激活态无需改图标文件即可变色）。来源见 .workbuddy/tmp/261123_extract_logcat_icons.py
import ClearIcon from './assets/icons/as-logcat/clear.svg?raw'
import TopIcon from './assets/icons/as-logcat/top.svg?raw'
import BottomIcon from './assets/icons/as-logcat/bottom.svg?raw'
import WrapIcon from './assets/icons/as-logcat/wrap.svg?raw'
import FormatIcon from './assets/icons/as-logcat/format.svg?raw'
import ColorsIcon from './assets/icons/as-logcat/colors.svg?raw'
import SearchIcon from './assets/icons/as-logcat/search.svg?raw'
import SidebarCloseIcon from './assets/icons/as-logcat/sidebar-close.svg?raw'
import SidebarOpenIcon from './assets/icons/as-logcat/sidebar-open.svg?raw'
import { actionIconSvg, MODE_ICONS } from './assets/icons/action-icons.js'

// 侧栏按钮行为标记：高危 > 弹窗 > 直接执行；直接执行不渲染任何标记。
// danger 只作高危语义（红色叹号）；红底仅保留给录屏/连拍的「停止」态。
function sbtnMode(it) {
  if ((it.act === 'recordStart' && recording.value) || (it.act === 'screenshotTimer' && screenshotting.value)) return ''
  return it.danger ? 'danger' : it.modal ? 'modal' : ''
}

const { COLOR_PRESETS, aboutOpen, activeLogSerial, activeMainTab, activityAuto, activityFilter, activityInterval, activityList, activityListFiltered, activityLoading, activityRunning, alwaysOnTop, appPkg, autoscroll, capturing, cmdGroup, cmdGroups, cmdOutput, cfg, collapsedSidebar, colorEditIndex, ctxMenu, currentLogErr, currentRunning, devGroups, deviceAlias, deviceClockActive, deviceClockOk, deviceClockSerial, deviceClockText, deviceInfo, deviceInfoLoading, devices, displayCmds, dumpsysOut, dumpsysService, editingNoteId, filterHistoryOpen, fmtMB, fmtRss, getpropFilter, getpropList, getpropListFiltered, getpropLoading, groupOpen, lastMsg, levelFilter, logEl, logFontStyle, managing, maximized, mergedView, newCmdArgs, newCmdGroup, newCmdIgnore, newCmdName, processAuto, processFilter, processInterval, processList, processListFiltered, processLoading, processRunning, procs, procsLoading, procFilterByPkg, procOptions, quickCommands, quickbarVisible, recording, regexFilter, runningMap, screenshotting, selectedProc, selectedSerial, serviceAuto, serviceFilter, serviceInterval, serviceList, serviceListFiltered, serviceLoading, serviceRunning, settingsOpen, tagFilter, tagHistory, tagWholeWord, textFilter, textHistory, threadAuto, threadFilter, threadInterval, threadList, threadListFiltered, threadLoading, threadRunning, toastMsg, toastShow, updateInfo, wrapLines } = State
const { collapseAll, disconnectDevice, displayName, expandAll, openConnectModal, openDeviceMenu, reconnectDevice, refreshDevices, runAction, selectDevice, toggleGroup } = useDevices()
const { saveCfg, addFilterHistory, removeFilterHistory } = useConfig()
const { parseLocal } = useApk()

const { clearKeywordFilter, clearLogs, browseLogDir, clearTagFilter, closeCtxMenu, commitNote, copySelection, editNote, exportLogs, findSegsFor, formatLogLine, onLogContextMenu, onLogKey, onLogMouseDown, onLogScrollSave, onLogWheel, onNoteInput, onNoteKey, onWheel, openFindFromCtx, openFindWindow, openFmt, openQuickFilter, refreshProcs, scrollToTop, selectAllLogs, toggleLatest, toggleLogcat } = useLogcat()

// 左侧栏宽度：由 cfg.sidebarWidth 驱动，拖右缘改宽度并随配置落盘；折叠时拖条隐藏但宽度值保留。
// 用 CSS 变量同时驱动 .sidebar 与 .side-scroll，避免两处硬编码 208px 漂移。
const sidebarStyle = computed(() => ({ '--sidebar-width': normalizeSidebarWidth(cfg.value.sidebarWidth) + 'px' }))
let sidebarDragCleanup = null
function onSidebarResizeStart(e) {
  if (e.button !== 0 || collapsedSidebar.value) return
  const startX = e.clientX
  const startW = normalizeSidebarWidth(cfg.value.sidebarWidth)
  const prevCursor = document.body.style.cursor
  const prevSelect = document.body.style.userSelect
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  function onMove(ev) {
    cfg.value.sidebarWidth = normalizeSidebarWidth(startW + ev.clientX - startX)
    saveCfg()   // 拖拽过程中去抖落盘，中途关窗也不丢宽度
  }
  function onUp() {
    sidebarDragCleanup = null
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    window.removeEventListener('blur', onUp)
    document.body.style.cursor = prevCursor
    document.body.style.userSelect = prevSelect
    saveCfg(true)  // 松手立即落盘，清掉尚未触发的去抖
  }
  if (sidebarDragCleanup) sidebarDragCleanup()
  sidebarDragCleanup = onUp
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  window.addEventListener('blur', onUp)
}

// 过滤框「历史」下拉：同一时刻只展开一个；点选直接写入对应过滤条件的 computed setter。
function toggleFilterHistoryMenu(kind) {
  filterHistoryOpen.value = filterHistoryOpen.value === kind ? '' : kind
}
function pickFilterHistory(kind, h) {
  if (kind === 'tag') tagFilter.value = h.text
  else textFilter.value = h.text
  filterHistoryOpen.value = ''
}
// 回车 / 失焦（值有变化）时提交当前过滤文本；空文本不入库。
function commitFilterHistory(kind) {
  addFilterHistory(kind, kind === 'tag' ? tagFilter.value : textFilter.value)
}

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
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  if (sidebarDragCleanup) sidebarDragCleanup()
})
const { addCmd, closeCmdOutput, cmdTextColor, onCmdArgsInput, onCmdColor, removeCmd, runCmd } = useActions()
const { exportDeviceInfo, exportGetprop, fetchGetprop, manualRefresh, runBugreport, runDumpsys, toggleDetect } = useDeviceinfo()
const { winClose, winMax, winMin, winTop } = useUi()
const { logLineStyle, openColorWin } = useColorrules()
useApp()
const { bgImageSrc, bgVisible } = useBackground()
const { refreshDeviceClock } = useDeviceClock()
const { openUpdateDialog } = useUpdate()
</script>

<template>
  <div class="app-bg" aria-hidden="true"><img v-if="bgVisible" class="app-bg-img" :src="bgImageSrc" alt="" /></div>
  <div class="app-root" @wheel="onWheel">
    <!-- 菜单栏（已合并自定义标题栏：左侧 收起/关于，右侧 窗口控制） -->
    <div class="menubar">
      <div class="menu-left">
        <!-- 侧栏折叠：双态图标。collapsedSidebar=true 表示已收起 → 显示「展开」图标；否则显示「收起」图标 -->
        <button class="sidebar-toggle" @click="collapsedSidebar = !collapsedSidebar"
                :title="collapsedSidebar ? t('menu.expandSidebar') : t('menu.collapseSidebar')"
                :aria-label="collapsedSidebar ? t('menu.expandSidebar') : t('menu.collapseSidebar')">
          <span class="menu-ico" v-html="collapsedSidebar ? SidebarOpenIcon : SidebarCloseIcon" />
        </button>
        <span class="menu-sep" aria-hidden="true"></span>
        <button @click="openConnectModal">{{ t('menu.connectDevice') }}</button>
        <button @click="refreshDevices">{{ t('menu.refreshDevices') }}</button>
        <span class="menu-sep" aria-hidden="true"></span>
        <button @click="parseLocal">{{ t('menu.parseLocalApk') }}</button>
        <span class="menu-sep" aria-hidden="true"></span>
        <button @click="settingsOpen = true">{{ t('menu.settings') }}</button>
        <button @click="aboutOpen = true">{{ t('menu.about') }}</button>
      </div>
      <div class="win-ctl">
        <!-- 设备时钟：紧邻最小化左侧。启动后默认不记时，点击一次才激活并开始同步设备时间（MM-dd HH:mm:ss） -->
        <div class="dev-clock" :class="{ off: !deviceClockOk, idle: !deviceClockActive }" @click="refreshDeviceClock"
             :title="!deviceClockActive ? t('sidebar.clockStart') : (deviceClockOk ? t('sidebar.clockSynced', { s: deviceClockSerial }) : t('sidebar.clockNoDevice'))">
          <span class="dev-clock-dot"></span>
          <span class="dev-clock-text">{{ deviceClockText }}</span>
        </div>
        <button class="win-top" :class="{ active: alwaysOnTop }" @click="winTop" :title="alwaysOnTop ? t('win.unpin') : t('win.pin')" :aria-pressed="alwaysOnTop">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5.4 2.2h5.2l-.8 4 2 2.1v1.1H4.2V8.3l2-2.1-.8-4Z" />
            <path d="M8 9.4v4.4" />
          </svg>
        </button>
        <button @click="winMin" :title="t('win.minimize')">–</button>
        <button @click="winMax" :title="maximized ? t('win.restore') : t('win.maximize')">{{ maximized ? '❐' : '▢' }}</button>
        <button class="win-close" @click="winClose" :title="t('common.close')">✕</button>
      </div>
    </div>

    <div class="body">
      <!-- 侧边栏：设备管理（设备列表，多设备并行） -->
      <aside class="sidebar" :class="{ collapsed: collapsedSidebar }" :style="sidebarStyle">
        <div class="side-scroll">
          <div class="dev-mgmt">
            <div class="dev-head">
              <div class="dev-head-btns">
                <button @click="expandAll">{{ t('sidebar.expandAll') }}</button>
                <button @click="collapseAll">{{ t('sidebar.collapseAll') }}</button>
              </div>
              <span>{{ t('sidebar.deviceMgmt') }}</span>
            </div>
            <div class="dev-list">
              <div v-if="!devices.length" class="dev-empty muted">{{ t('sidebar.noDevices') }}</div>
              <div v-for="d in devices" :key="d.serial" class="dev-item" :class="{ active: d.serial === selectedSerial }" @click="selectDevice(d.serial)" @contextmenu.prevent="openDeviceMenu(d, $event)">
                <div class="dev-meta">
                  <span class="dev-serial">{{ displayName(d.serial) }}</span>
                  <span v-if="deviceAlias[d.serial]" class="dev-status" :class="{ off: d.status !== 'device' }" :title="d.status">{{ d.serial }}</span>
                </div>
                <div class="dev-acts" @click.stop>
                  <button class="dev-disc" :title="t('sidebar.disconnect')" @click="disconnectDevice(d.serial)">{{ t('common.close') }}</button>
                  <button class="dev-reconn" :title="t('sidebar.reconnectHint')" @click="reconnectDevice(d.serial)">{{ t('sidebar.reconnect') }}</button>
                </div>
              </div>
            </div>
            <div v-for="g in devGroups" :key="g.key" class="sgroup">
              <div class="sg-head" @click="toggleGroup(g.key)">
                <span class="caret">{{ groupOpen[g.key] ? '▾' : '▸' }}</span>{{ t(g.titleKey) }}
              </div>
              <div v-show="groupOpen[g.key]" class="sg-body">
                <template v-for="(it, i) in g.items" :key="it.act || it.kind || i">
                  <!-- 应用包名输入框（仅 应用操作 分组内含） -->
                  <label v-if="it.kind === 'pkg'" class="pkg-row">{{ t('sidebar.appPackage') }}
                    <input v-model="appPkg" :placeholder="t('sidebar.pkgPlaceholder')" @change="saveCfg" />
                  </label>
                  <button v-else :class="['sbtn', {
                    primary: (it.act === 'recordStart' && !recording) || (it.act === 'screenshotTimer' && !screenshotting),
                    danger: (it.act === 'recordStart' && recording) || (it.act === 'screenshotTimer' && screenshotting)
                  }]"
                    :data-mode="sbtnMode(it)"
                    :disabled="(!selectedSerial && !it.server) || (it.needProc && !selectedProc) || (it.needPkg && !appPkg)"
                    @click="runAction(it)">
                    <span class="sbtn-ico" v-html="actionIconSvg(it.icon)" aria-hidden="true"></span>
                    <span class="sbtn-label">{{ (it.act === 'recordStart' && recording) ? t('action.stopRecord') : (it.act === 'screenshotTimer' && screenshotting) ? t('action.stopScreenshot') : (it.act === 'captureToggle' && capturing[selectedSerial]) ? t('action.stopCapture') : (it.labelKey ? t(it.labelKey) : it.label) }}</span>
                    <span v-if="sbtnMode(it)" class="sbtn-mode" v-html="MODE_ICONS[sbtnMode(it)]" aria-hidden="true"></span>
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <!-- 侧栏右缘拖拽条：独立 flex 项，不压住 .side-scroll 的垂直滚动条；收起时不显示 -->
      <div v-if="!collapsedSidebar" class="sidebar-resizer" :title="t('sidebar.resizeHint')" @mousedown.prevent="onSidebarResizeStart"></div>

      <!-- 功能区：日志窗口（按设备分 tab） -->
      <main class="main">
        <div class="areatabs">
          <button :class="{ active: activeMainTab === 'log' }" @click="activeMainTab = 'log'">{{ t('tab.log') }}</button>
          <button :class="{ active: activeMainTab === 'info' }" @click="activeMainTab = 'info'">{{ t('tab.info') }}</button>
          <button :class="{ active: activeMainTab === 'activity' }" @click="activeMainTab = 'activity'">{{ t('tab.activity') }}</button>
          <button :class="{ active: activeMainTab === 'service' }" @click="activeMainTab = 'service'">{{ t('tab.service') }}</button>
          <button :class="{ active: activeMainTab === 'process' }" @click="activeMainTab = 'process'">{{ t('tab.process') }}</button>
          <button :class="{ active: activeMainTab === 'thread' }" @click="activeMainTab = 'thread'">{{ t('tab.thread') }}</button>
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
            <span v-if="!devices.length" class="muted">{{ t('log.noDevice') }}</span>
          </div>
          <div class="toolbar">
            <button :class="currentRunning ? 'danger' : 'primary'" @click="toggleLogcat">{{ currentRunning ? t('common.stop') : t('common.start') }}</button>
            <span class="toolbar-gap"></span>
            <AppSelect v-model="levelFilter" class="level-select"
                       :options="[{ value: 'V', label: 'Verbose' }, { value: 'D', label: 'Debug' }, { value: 'I', label: 'Info' }, { value: 'W', label: 'Warn' }, { value: 'E', label: 'Error' }, { value: 'F', label: 'Assert' }]" />
            <span class="toolbar-gap"></span>
            <label class="proc-chk" :title="t('log.pkgFilterHint')">
              <input type="checkbox" v-model="procFilterByPkg" />{{ t('log.filterByPkg') }}
            </label>
            <span class="proc-wrap">
              <!-- 原生 select 的弹出层在 mousedown 瞬间就快照了 option 列表：若在 mousedown 里异步拉进程，
                   结果回来时弹层已打开，DOM 更新不会回填当前弹层 —— 表现为「点开就是空白」。
                   故去掉点开即刷新，改成独立 ↻ 按钮（在弹层外点击，数据到齐后再打开下拉）。
                   列表由启动 / 切设备 / proc:changed 事件预拉，失败保留上一次成功列表。 -->
              <AppSelect v-model="selectedProc" :disabled="!activeLogSerial" style="max-width:200px" :title="t('log.procSelectHint')"
                         :options="[{ value: '', label: procFilterByPkg ? t('log.pkgOnly') : t('log.pkgProc') }, ...(procsLoading[activeLogSerial] ? [{ value: '', label: t('common.loading'), disabled: true }] : []), ...procOptions]" />
              <button type="button" class="proc-refresh" :title="t('log.refreshProcs')" @click="() => refreshProcs()">↻</button>
            </span>
            <span class="toolbar-gap"></span>
            <span class="kwfilter-wrap tag-wrap">
              <span class="filter-history">
                <button class="fh-btn" type="button" :title="t('log.tagHistoryHint')"
                        @click="toggleFilterHistoryMenu('tag')">
                  <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
                </button>
                <div v-if="filterHistoryOpen === 'tag'" class="fh-menu">
                  <div class="fh-menu-head">{{ t('log.tagHistory') }}<span class="fh-menu-tip">{{ t('log.clickToFill') }}</span></div>
                  <div v-if="!tagHistory.length" class="fh-empty">{{ t('log.noHistory') }}</div>
                  <div v-for="h in tagHistory" :key="h.text" class="fh-item" :class="{ locked: h.locked }"
                       :title="h.locked ? t('log.lockedHint') : t('log.clickToFill')" @click="pickFilterHistory('tag', h)">
                    <span class="fh-item-text">{{ h.text }}</span><span v-if="h.locked" class="fh-lock-tag">{{ t('log.lockTag') }}</span>
                    <button class="fh-x" type="button" :disabled="h.locked"
                            :title="h.locked ? t('log.lockedNoDelete') : t('log.deleteHistory')"
                            @click.stop="removeFilterHistory('tag', h.text)">×</button>
                  </div>
                </div>
              </span>
              <input v-model="tagFilter" :placeholder="t('log.tagFilterPlaceholder')" @keydown.enter="commitFilterHistory('tag')" @change="commitFilterHistory('tag')" />
              <button v-if="tagFilter" class="kw-clear" type="button" @click="clearTagFilter" :title="t('log.clearTagFilter')">×</button>
            </span>
            <label :title="t('log.wholeWordHint')"><input type="checkbox" v-model="tagWholeWord" />{{ t('log.wholeWord') }}</label>
            <span class="toolbar-gap"></span>
            <label><input type="checkbox" v-model="regexFilter" />Regex</label>
            <span class="kwfilter-wrap">
              <span class="filter-history">
                <button class="fh-btn" type="button" :title="t('log.textHistoryHint')"
                        @click="toggleFilterHistoryMenu('text')">
                  <svg viewBox="0 0 10 6" width="9" height="6" aria-hidden="true"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
                </button>
                <div v-if="filterHistoryOpen === 'text'" class="fh-menu">
                  <div class="fh-menu-head">{{ t('log.textHistory') }}<span class="fh-menu-tip">{{ t('log.clickToFill') }}</span></div>
                  <div v-if="!textHistory.length" class="fh-empty">{{ t('log.noHistory') }}</div>
                  <div v-for="h in textHistory" :key="h.text" class="fh-item" :class="{ locked: h.locked }"
                       :title="h.locked ? t('log.lockedHint') : t('log.clickToFill')" @click="pickFilterHistory('text', h)">
                    <span class="fh-item-text">{{ h.text }}</span><span v-if="h.locked" class="fh-lock-tag">{{ t('log.lockTag') }}</span>
                    <button class="fh-x" type="button" :disabled="h.locked"
                            :title="h.locked ? t('log.lockedNoDelete') : t('log.deleteHistory')"
                            @click.stop="removeFilterHistory('text', h.text)">×</button>
                  </div>
                </div>
              </span>
              <input v-model="textFilter" :placeholder="t('log.textFilterPlaceholder')" @keydown.enter="commitFilterHistory('text')" @change="commitFilterHistory('text')" />
              <button v-if="textFilter" class="kw-clear" type="button" @click="clearKeywordFilter" :title="t('log.clearTextFilter')">×</button>
            </span>
            <button @click="openQuickFilter" :title="t('log.quickFilterHint')">{{ t('log.quickFilter') }}</button>
            <span class="toolbar-gap"></span>
            <button @click="exportLogs">{{ t('common.export') }}</button>
            <button @click="browseLogDir" :title="t('log.browseHint')">{{ t('common.browse') }}</button>
            <span v-if="currentLogErr" class="muted" style="color:var(--danger)">{{ currentLogErr }}</span>
          </div>
          <!-- 日志区主体：左侧竖向工具条（顶部/底部/清空）+ 日志窗口，仿 Android Studio Logcat -->
          <div class="log-body">
            <div class="log-side-tools">
              <button @click="clearLogs" :title="t('log.clear')" :aria-label="t('log.clear')"><span class="log-tool-ico" v-html="ClearIcon" /></button>
              <button @click="scrollToTop" :title="t('log.scrollTop')" :aria-label="t('log.scrollTop')"><span class="log-tool-ico" v-html="TopIcon" /></button>
              <button :class="{ active: autoscroll }" @click="toggleLatest" :title="t('log.followHint')" :aria-label="t('log.follow')"><span class="log-tool-ico" v-html="BottomIcon" /></button>
              <button :class="{ active: wrapLines }" @click="wrapLines = !wrapLines" :title="t('log.wrapHint')" :aria-label="t('log.wrap')"><span class="log-tool-ico" v-html="WrapIcon" /></button>
              <div class="log-side-sep"></div>
              <button @click="openFmt" :title="t('log.formatHint')" :aria-label="t('log.format')"><span class="log-tool-ico" v-html="FormatIcon" /></button>
              <button @click="openColorWin" :title="t('log.colorsHint')" :aria-label="t('log.colors')"><span class="log-tool-ico" v-html="ColorsIcon" /></button>
              <div class="log-side-sep"></div>
              <button @click="openFindWindow" :title="t('log.searchHint')" :aria-label="t('log.search')"><span class="log-tool-ico" v-html="SearchIcon" /></button>
            </div>
            <div class="logview" :class="{ nowrap: !wrapLines }" :style="logFontStyle" ref="logEl" tabindex="-1" @keydown="onLogKey" @scroll="onLogScroll" @wheel="onLogWheel" @mousedown="onLogMouseDown" @contextmenu="onLogContextMenu($event)" @click="onLogClick">
            <div v-if="logCaret.visible" class="log-caret" :style="{ left: logCaret.x + 'px', top: logCaret.y + 'px' }"></div>
            <div v-if="!mergedView.length" class="muted">{{ t('log.emptyHint', { dev: activeLogSerial || t('common.device') }) }}</div>
            <template v-for="e in mergedView" :key="e.id">
              <div v-if="e.kind !== 'note'" class="logline" :style="logLineStyle(e)" :data-log-id="e.id"
                   :title="t('log.lineHint')">
                <template v-for="segs in [findSegsFor(e)]" :key="e.id + '-segs'">
                  <template v-if="segs">
                    <span v-for="(s, i) in segs" :key="i" :class="{ 'find-hit': s.hit, 'find-cur': s.cur }">{{ s.t }}</span>
                  </template>
                  <template v-else>{{ formatLogLine(e) }}</template>
                </template>
              </div>
              <div v-else class="note-line" :class="{ editing: e.id === editingNoteId }" :data-log-id="e.id" @click="editNote(e)">
                <span v-if="e.id !== editingNoteId" class="note-text" :title="t('log.noteHint')">
                  <template v-for="segs in [findSegsFor(e)]" :key="e.id + '-segs'">
                    <template v-if="segs">
                      <span v-for="(s, i) in segs" :key="i" :class="{ 'find-hit': s.hit, 'find-cur': s.cur }">{{ s.t }}</span>
                    </template>
                    <template v-else>{{ e.text }}</template>
                  </template>
                </span>
                <textarea v-else :data-note-input="e.id" class="note-input" rows="1" v-model="e.text"
                          @keydown.stop="onNoteKey($event, e)" @input="onNoteInput($event, e)" @blur="commitNote(e)"></textarea>
              </div>
            </template>
            <div class="logview-tail" :title="t('log.tailHint')"></div>
          </div>
            </div><!-- /.log-body -->
          <!-- 右键菜单：Teleport 到 body，彻底脱离日志区 overflow 容器，避免被裁剪看不见 -->
          <Teleport to="body">
            <div v-if="ctxMenu.visible" class="ctx-overlay" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu">
              <div class="ctx-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
                <button class="ctx-item" :disabled="!ctxMenu.text" @click="copySelection">{{ t('common.copy') }}</button>
                <button class="ctx-item" @click="selectAllLogs">{{ t('log.selectAll') }}</button>
                <button class="ctx-item" @click="openFindFromCtx">{{ t('common.search') }}</button>
                <button class="ctx-item ctx-clear" @click="clearLogs(); ctxMenu.visible = false">{{ t('common.clear') }}</button>
              </div>
            </div>
          </Teleport>
          <!-- 查找窗口：布局参考 Notepad++「查找」对话框；浮动面板（非遮罩），不挡住日志区的滚动与右键操作 -->
          <FindWindow />
        </div>
        <div v-else-if="activeMainTab === 'info'" class="infoarea">
          <div class="info-toolbar">
            <button :disabled="deviceInfoLoading || !Object.keys(deviceInfo).length" @click="exportDeviceInfo">{{ t('common.export') }}</button>
          </div>
          <div v-if="deviceInfoLoading" class="muted">{{ t('info.loading') }}</div>
          <template v-else>
            <div class="info-grid">
              <div class="info-card"><div class="info-label">{{ t('info.name') }}</div><div class="info-val">{{ displayName(selectedSerial) }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.model') }}</div><div class="info-val">{{ deviceInfo.model }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.androidVersion') }}</div><div class="info-val">{{ deviceInfo.androidVersion }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.resolution') }}</div><div class="info-val">{{ deviceInfo.resolution }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.density') }}</div><div class="info-val">{{ deviceInfo.density }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.memTotal') }}</div><div class="info-val">{{ deviceInfo.memTotal }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.memAvailable') }}</div><div class="info-val">{{ deviceInfo.memAvailable }}</div></div>
              <div class="info-card"><div class="info-label">{{ t('info.storage') }}</div><div class="info-val">{{ deviceInfo.storage }}</div></div>
              <div class="info-card"><div class="info-label">CPU</div><div class="info-val">{{ deviceInfo.cpu }}</div></div>
              <div class="info-card"><div class="info-label">android_id</div><div class="info-val">{{ deviceInfo.androidId }}</div></div>
              <div class="info-card"><div class="info-label">stbid</div><div class="info-val">{{ deviceInfo.stbId }}</div></div>
              <div class="info-card"><div class="info-label">oid</div><div class="info-val">{{ deviceInfo.oid }}</div></div>
            </div>
            <div class="info-block">
              <div class="info-label">{{ t('info.foreground') }}</div>
              <code class="info-code">{{ deviceInfo.foregroundActivity }}</code>
            </div>
            <div class="info-block">
              <div class="info-label">{{ t('info.mac') }}</div>
              <div class="mac-list">
                <code v-for="m in (deviceInfo.macs || [])" :key="m" class="info-code">{{ m }}</code>
              </div>
              <div v-if="!(deviceInfo.macs && deviceInfo.macs.length)" class="muted">—</div>
            </div>
            <div class="info-block">
              <div class="info-label">{{ t('info.dumpsys') }}</div>
              <div class="row">
                <input v-model="dumpsysService" :placeholder="t('info.dumpsysPlaceholder')" style="flex:1" />
                <button class="primary" @click="runDumpsys">{{ t('common.run') }}</button>
                <button @click="runBugreport">bugreport</button>
              </div>
              <pre v-if="dumpsysOut" class="dumpsys-out">{{ dumpsysOut }}</pre>
            </div>
          </template>
        </div>
        <PollingListTab v-else-if="activeMainTab === 'activity'"
          v-model:filter="activityFilter" v-model:auto="activityAuto" v-model:interval="activityInterval"
          :running="activityRunning" :loading="activityLoading"
          :label="t('info.foreground')" :loading-text="t('list.activityLoading')" :empty-text="t('info.foreground')"
          :count="activityList.length" :matched="activityListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('activity')" @refresh="manualRefresh('activity')">
          <div v-for="a in activityListFiltered" :key="a.name" class="svc-item">
            <span class="svc-name">{{ a.name }}</span>
            <span v-if="a.foreground" class="fg-badge">{{ t('list.foreground') }}</span>
          </div>
          <div v-if="!activityListFiltered.length" class="muted">{{ t('common.none') }}</div>
        </PollingListTab>
        <PollingListTab v-else-if="activeMainTab === 'service'"
          v-model:filter="serviceFilter" v-model:auto="serviceAuto" v-model:interval="serviceInterval"
          :running="serviceRunning" :loading="serviceLoading"
          :label="t('list.service')" :loading-text="t('list.serviceLoading')" :empty-text="t('list.service')"
          :count="serviceList.length" :matched="serviceListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('service')" @refresh="manualRefresh('service')">
          <div v-for="s in serviceListFiltered" :key="s" class="svc-item">{{ s }}</div>
          <div v-if="!serviceListFiltered.length" class="muted">{{ t('common.none') }}</div>
        </PollingListTab>
        <PollingListTab v-else-if="activeMainTab === 'process'"
          v-model:filter="processFilter" v-model:auto="processAuto" v-model:interval="processInterval"
          :running="processRunning" :loading="processLoading"
          :label="t('list.process')" :loading-text="t('list.processLoading')" :empty-text="t('list.processEmpty')"
          :count="processList.length" :matched="processListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('process')" @refresh="manualRefresh('process')">
          <table v-if="processListFiltered.length" class="svc-table">
            <thead><tr>
              <th class="col-pid">PID</th><th class="col-name">NAME</th>
              <th class="col-num">CPU%</th><th class="col-num">RSS(MB)</th><th class="col-num">VSZ(MB)</th>
              <th class="col-num">{{ t('tab.thread') }}</th><th class="col-state">{{ t('list.state') }}</th><th class="col-num">{{ t('list.readMb') }}</th><th class="col-num">{{ t('list.writeMb') }}</th>
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
          <div v-else class="muted">{{ t('common.none') }}</div>
        </PollingListTab>
        <PollingListTab v-else-if="activeMainTab === 'thread'"
          v-model:filter="threadFilter" v-model:auto="threadAuto" v-model:interval="threadInterval"
          :running="threadRunning" :loading="threadLoading"
          :label="t('list.thread')" :loading-text="t('list.threadLoading')" :empty-text="t('list.threadEmpty')"
          :count="threadList.length" :matched="threadListFiltered.length" :serial="selectedSerial"
          @toggle="toggleDetect('thread')" @refresh="manualRefresh('thread')">
          <table v-if="threadListFiltered.length" class="svc-table">
            <thead><tr><th class="col-user">USER</th><th class="col-pid">PID</th><th class="col-tid">TID</th><th class="col-name">NAME</th><th class="col-num">CPU%</th><th class="col-state">{{ t('list.state') }}</th></tr></thead>
            <tbody>
              <tr v-for="t in threadListFiltered" :key="t.pid + '-' + t.tid + '-' + t.name">
                <td class="col-user">{{ t.user }}</td><td class="col-pid">{{ t.pid }}</td><td class="col-tid">{{ t.tid }}</td><td class="col-name" :title="t.name">{{ t.name }}</td>
                <td class="col-num">{{ t.cpu.toFixed(1) }}</td><td class="col-state">{{ t.state }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="muted">{{ t('common.none') }}</div>
        </PollingListTab>
        <div v-else-if="activeMainTab === 'getprop'" class="listarea">
          <div class="list-toolbar">
            <input class="list-filter" v-model="getpropFilter" :placeholder="t('getprop.filterPlaceholder', { n: getpropList.length })" />
            <button :disabled="getpropLoading" @click="fetchGetprop()">{{ t('common.refresh') }}</button>
            <button :disabled="getpropLoading || !getpropList.length" @click="exportGetprop">{{ t('common.export') }}</button>
          </div>
          <div v-if="getpropLoading" class="muted">{{ t('getprop.loading') }}</div>
          <div v-else class="info-block">
            <div class="info-label">{{ t('getprop.title', { n: getpropList.length, suffix: getpropFilter ? t('getprop.matched', { c: getpropListFiltered.length }) : '' }) }}</div>
            <div class="svc-list">
              <div v-for="p in getpropListFiltered" :key="p.key" class="prop-item">
                <span class="prop-key">{{ p.key }}</span>
                <span class="prop-val">{{ p.value || '—' }}</span>
              </div>
              <div v-if="!getpropListFiltered.length" class="muted">{{ t('common.none') }}</div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 快捷按钮区（状态栏上一行、设备管理/日志窗口下一行）；默认收起隐藏，由状态栏「快捷按钮」开关展开 -->
    <div v-if="quickbarVisible" class="quickbar">
      <div class="qb-head">
        <span class="qb-title">{{ t('quickbar.title') }}</span>
        <AppSelect v-model="cmdGroup" class="qb-group"
                   :options="[{ value: ALL_GROUPS, label: t('quickbar.allGroups') }, ...cmdGroups]" />
        <button class="qb-manage" @click="managing = !managing">{{ managing ? t('common.done') : t('common.manage') }}</button>
        <button class="qb-close" @click="closeCmdOutput" :title="t('quickbar.closeHint')">✕</button>
      </div>
      <div class="qb-buttons">
        <button v-for="(c, i) in displayCmds" :key="i" class="qbtn" :style="{ background: c.color || '', color: cmdTextColor(c.color) }" @click="runCmd(c)">{{ c.name }}</button>
        <span v-if="!displayCmds.length" class="muted">{{ t('quickbar.empty') }}</span>
      </div>
      <div v-if="managing" class="qb-edit">
        <div class="row">
          <input v-model="newCmdName" :placeholder="t('quickbar.cmdName')" style="width:140px" />
          <input v-model="newCmdArgs" :placeholder="t('quickbar.cmdArgs')" style="flex:1" />
            <input v-model="newCmdGroup" :placeholder="t('quickbar.groupOptional')" style="width:110px" />
            <label class="chk"><input type="checkbox" v-model="newCmdIgnore" /> {{ t('quickbar.ignoreResponse') }}</label>
            <button class="primary" @click="addCmd">{{ t('common.add') }}</button>
        </div>
        <div class="cmdlist">
          <div v-for="(c, i) in quickCommands" :key="i" class="cmditem">
            <input class="ci-name" v-model="c.name" @change="saveCfg" :placeholder="t('quickbar.cmdName')" />
            <input class="ci-args" :value="c.args.join(' ')" @input="onCmdArgsInput(i, $event.target.value)" :placeholder="t('quickbar.args')" />
            <input class="ci-group" v-model="c.group" @change="saveCfg" :placeholder="t('quickbar.group')" />
            <button class="ci-color" @click="colorEditIndex = (colorEditIndex === i ? null : i)">{{ t('common.color') }}</button>
            <button class="ci-del" @click="removeCmd(i)">{{ t('common.delete') }}</button>
            <label class="chk"><input type="checkbox" v-model="c.ignoreResponse" @change="saveCfg" /> {{ t('quickbar.ignoreResponse') }}</label>
            <div v-if="colorEditIndex === i" class="color-pop">
              <input type="color" :value="c.color || '#4a90d9'" @input="onCmdColor(i, $event.target.value)" />
              <div class="swatches">
                <button v-for="sw in COLOR_PRESETS" :key="sw" :style="{ background: sw }" @click="onCmdColor(i, sw)" :title="sw"></button>
              </div>
              <button class="ci-ok" @click="colorEditIndex = null">{{ t('common.done') }}</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="cmdOutput" class="output">{{ cmdOutput }}</div>
    </div>

    <!-- 状态栏：只展示设备连接态与「进行中」提示；所有结果性文字已迁到 ResultModal -->
    <div class="statusbar">
      <span class="status-dot" :class="selectedSerial ? 'dot-ok' : 'dot-idle'"></span>
      <span>{{ selectedSerial || t('status.disconnected') }}</span>
      <span class="sb-sep">|</span>
      <span>{{ t('status.deviceCount') }} {{ devices.length }}</span>
      <span class="sb-sep">|</span>
      <span>{{ t('status.current') }}{{ activeLogSerial || '—' }}</span>
      <span class="sb-sep">|</span>
      <span v-if="updateInfo && updateInfo.hasUpdate" class="sb-update" style="color:var(--primary);cursor:pointer" @click="openUpdateDialog">{{ t('status.newVersion') }}{{ updateInfo.latest }}</span>
      <span v-if="updateInfo && updateInfo.hasUpdate" class="sb-sep">|</span>
      <span class="sb-msg">{{ lastMsg }}</span>
      <span class="sb-sep">|</span>
      <button class="sb-toggle" :class="{ active: quickbarVisible }" @click="quickbarVisible = !quickbarVisible" :title="quickbarVisible ? t('status.collapseQuickbar') : t('status.expandQuickbar')">{{ t('quickbar.title') }}</button>
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

    <!-- 离线日志管理弹窗 -->
    <OfflineLogModal />

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

    <!-- 统一结果弹窗：成功/失败 + 可选中复制的结果文本 -->
    <ResultModal />

    <!-- 非阻断式进行中指示（安装 APK 等后台任务），不遮挡任何元素 -->
    <BusyIndicator />

    <!-- Toast -->
    <div v-if="toastShow" class="toast">{{ toastMsg }}</div>
  </div>
</template>
