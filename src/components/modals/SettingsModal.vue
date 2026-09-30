<script setup>
// 设置面板：通用 / 窗口属性 / 程序日志路径 / 日志字体 / 日志级别颜色 / 日志内容颜色 / 日志自动保存 / 抓包设置 / 截图设置
import * as State from '@/composables/state'
import {
  maskClose, setTab, resetLogColors, onLogColorChange, onHexInput, onBgInput,
  browseOutDir, onMaxRenderChange, browseConfigPath, exportSettings, importSettings,
  onFontChange, openFontPicker, pickFont, saveCfg,
  browseCaptureLocalDir, browseScreenshotDir
} from '@/composables/useConfig'
import { onAutoLogChange, onAppLogChange, browseAppLogDir } from '@/composables/useLogcat'
import { openAddColorRule } from '@/composables/useColorrules'
import ColorRulesTable from '../ColorRulesTable.vue'

const {
  settingsOpen, settingsTab, levelList, logColors, logColorBold, logBgColors, logBgOn,
  autoLog, cfg, appLogEnabled, globalColorRulesView,
  logFont, fontQuery, fontPickerOpen, filteredFonts, logFontStyle
} = State
</script>

<template>
  <div v-if="settingsOpen" class="modal-mask" @click.self="maskClose(() => settingsOpen = false)">
    <div class="modal settings-modal">
      <div class="modal-head">
        设置
        <button class="modal-x" @click="settingsOpen = false">×</button>
      </div>
      <div class="settings-body">
        <div class="settings-tabs">
          <button :class="{ active: settingsTab === 'general' }" @click="setTab('general')">通用</button>
          <button :class="{ active: settingsTab === 'win' }" @click="setTab('win')">窗口属性</button>
          <button :class="{ active: settingsTab === 'applog' }" @click="setTab('applog')">程序日志路径</button>
          <button :class="{ active: settingsTab === 'font' }" @click="setTab('font')">日志字体</button>
          <button :class="{ active: settingsTab === 'colors' }" @click="setTab('colors')">日志级别颜色</button>
          <button :class="{ active: settingsTab === 'contentcolor' }" @click="setTab('contentcolor')">日志内容颜色</button>
          <button :class="{ active: settingsTab === 'autolog' }" @click="setTab('autolog')">日志自动保存</button>
          <button :class="{ active: settingsTab === 'capture' }" @click="setTab('capture')">抓包设置</button>
          <button :class="{ active: settingsTab === 'shot' }" @click="setTab('shot')">截图设置</button>
        </div>
        <div class="settings-content">
          <div v-if="settingsTab === 'colors'">
            <div class="color-head">
              <p class="muted small">按日志级别设置文本色 / 加粗 / 背景色；「背景」默认不勾选（勾选后才给该行上背景色）。</p>
              <div class="color-reset-row"><button class="outdir-btn" @click="resetLogColors">恢复默认</button></div>
            </div>
            <div class="color-grid">
              <label v-for="lv in levelList" :key="lv.key" class="color-row">
                <span class="color-name">{{ lv.label }}</span>
                <input type="color" v-model="logColors[lv.key]" @change="onLogColorChange" />
                <input type="text" class="color-hex-input" :value="logColors[lv.key]" @input="onHexInput(lv.key, $event.target.value)" maxlength="7" spellcheck="false" />
                <span class="color-bold"><input type="checkbox" v-model="logColorBold[lv.key]" @change="onLogColorChange" /> 加粗</span>
                <span class="color-bg"><input type="checkbox" v-model="logBgOn[lv.key]" @change="onLogColorChange" /> 背景</span>
                <input type="color" v-model="logBgColors[lv.key]" :disabled="!logBgOn[lv.key]" @change="onLogColorChange" />
                <input type="text" class="color-hex-input" :value="logBgColors[lv.key]" :disabled="!logBgOn[lv.key]" @input="onBgInput(lv.key, $event.target.value)" maxlength="7" spellcheck="false" />
              </label>
            </div>
          </div>
          <div v-if="settingsTab === 'autolog'" class="autolog-box">
            <label class="switch-row">
              <input type="checkbox" v-model="autoLog" @change="onAutoLogChange" />
              <span>是否自动保存日志（开启后写入磁盘，按设备分文件）</span>
            </label>
            <div class="outdir-row">
              <span class="outdir-label">保存路径</span>
              <input class="outdir-input" :value="cfg.outDir" readonly />
              <button class="outdir-btn" @click="browseOutDir">浏览…</button>
            </div>
            <p class="muted small">开启后，每台设备的日志按天写入 <code>{{ cfg.outDir }}/logcat_&lt;机型_序列号&gt;_yyyyMMddHHmmss.log</code>：文件名含设备机型与序列号便于多设备区分，文件名为开始写日志的时刻，每天一个文件；写入在后台异步完成，不卡界面。</p>
          </div>
          <div v-if="settingsTab === 'contentcolor'" class="contentcolor-box">
            <div class="contentcolor-head">
              <span class="muted small">按关键字给日志行上色：Tag / 日志内容 的匹配逻辑同日志窗口的「Tag 过滤」「关键字过滤」；命中规则的颜色优先级高于「日志级别颜色」按级别的颜色。规则随配置持久化。</span>
              <button class="outdir-btn" @click="openAddColorRule('global')">新增</button>
            </div>
            <ColorRulesTable :items="globalColorRulesView" />
          </div>
          <div v-if="settingsTab === 'general'" class="general-box">
            <div class="outdir-row">
              <span class="outdir-label">日志渲染上限（行）</span>
              <input class="font-input" type="number" min="1000" max="200000" step="1000" v-model.number="cfg.maxRender" @change="onMaxRenderChange" />
            </div>
            <p class="muted small">日志窗口最多渲染最后的 N 行（过滤后截取尾部）：日志刷得快的设大些可看更久历史；值越大 DOM 节点越多，过大可能卡顿。修改即时生效并自动保存。</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.cursorMoveNoScroll" @change="saveCfg" />
              <span>光标移动不滚动日志区窗口（默认开启）</span>
            </label>
            <p class="muted small">开启后，日志区出现光标（鼠标点击日志）时，上下左右方向键移动的是光标本身：左右到行尾 / 行首会自动跨到上一行末 / 下一行首，上下到顶 / 底会带动垂直滚动条。关闭则方向键照常滚动日志窗口。该选项仅影响「日志区已有光标」的场景；未点击日志时光标键仍正常滚动。</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.checkUpdateOnStartup" @change="saveCfg" />
              <span>启动时检测版本升级（默认开启）</span>
            </label>
            <div class="outdir-row">
              <span class="outdir-label">配置文件路径</span>
              <input class="outdir-input" :value="cfg.configPath || '(默认：exe/工程根同级的 adbtool-config.json)'" readonly />
              <button class="outdir-btn" @click="browseConfigPath">浏览…</button>
            </div>
            <p class="muted small">自定义 <code>adbtool-config.json</code> 的存放位置（完整文件路径，含文件名）。留空则使用默认位置；指定后程序重启会从该位置读取，便于把配置放到有写权限的目录（如规避 C:\Program Files 权限问题）或云同步盘。当前生效：<code>{{ cfg.configPath || '默认位置（exe/工程根同级）' }}</code>。</p>
            <div class="general-io">
              <button class="outdir-btn" @click="exportSettings">导出设置</button>
              <button class="outdir-btn" @click="importSettings">导入设置</button>
            </div>
            <p class="muted small">导出 / 导入全部设置（快捷命令、过滤条件、日志字体 / 颜色、抓包 / 截图参数、自动保存开关等）。导入会覆盖当前设置并立即生效；为安全起见，仅导入设置项，不会改写本机配置文件存放位置、也不会切换当前已选设备。</p>
          </div>
          <div v-if="settingsTab === 'applog'" class="applog-box">
            <label class="switch-row">
              <input type="checkbox" v-model="appLogEnabled" @change="onAppLogChange" />
              <span>是否写入程序日志（开启后程序自身的运行 / 调试日志落盘到下方目录）</span>
            </label>
            <div class="outdir-row">
              <span class="outdir-label">保存路径</span>
              <input class="outdir-input" :value="cfg.appLogDir" readonly />
              <button class="outdir-btn" @click="browseAppLogDir">浏览…</button>
            </div>
            <p class="muted small">开启后，程序运行日志（含 console 打印与未捕获异常）写入 <code>{{ cfg.appLogDir }}/app.log</code>：追加模式、带时间戳与级别，不卡界面；关闭则只输出到控制台。</p>
          </div>
          <div v-if="settingsTab === 'font'" class="font-box">
            <label class="switch-row">
              <span>字体大小</span>
              <input type="number" min="8" max="32" step="1" v-model.number="logFont.size" @change="onFontChange" />
              <span class="muted small">px（8~32）</span>
            </label>
            <div class="switch-row">
              <span>字体类型</span>
              <div class="font-picker">
                <input type="text" class="font-input" v-model="fontQuery" spellcheck="false"
                       placeholder="输入关键字筛选字体" @focus="openFontPicker" @input="fontPickerOpen = true" />
                <div v-if="fontPickerOpen" class="font-dropdown">
                  <div v-for="o in filteredFonts" :key="o.value" class="font-opt"
                       :class="{ active: o.value === logFont.family }" :title="o.label"
                       @click="pickFont(o)">{{ o.label }}</div>
                  <div v-if="!filteredFonts.length" class="font-empty">无匹配字体</div>
                </div>
              </div>
            </div>
            <label class="switch-row">
              <input type="checkbox" v-model="logFont.bold" @change="onFontChange" />
              <span>加粗显示</span>
            </label>
            <label class="switch-row">
              <span>行间距</span>
              <input type="number" min="1" max="3" step="0.1" v-model.number="logFont.lineHeight" @change="onFontChange" />
              <span class="muted small">倍（1.0~3.0，默认 1.4）</span>
            </label>
            <div class="font-preview" :style="logFontStyle">I/Hello 世界 2018-02-07 06:16:28.555 com.example.sample: sample log line</div>
            <p class="muted small">设置即时生效并自动保存，重启后保留。</p>
          </div>
          <div v-if="settingsTab === 'win'" class="win-box">
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.closeOnOuterClick" @change="saveCfg" />
              <span>允许点击窗口外部关闭弹窗（默认不允许）</span>
            </label>
            <p class="muted small">开启后，鼠标点击弹窗遮罩空白处会关闭弹窗；关闭时点击外部不生效，只能点「取消」或「×」关闭。</p>
          </div>
          <div v-if="settingsTab === 'capture'" class="capture-box">
            <div class="outdir-row">
              <span class="outdir-label">tcpdump 参数</span>
              <input class="outdir-input" v-model="cfg.captureArgs" @change="saveCfg" spellcheck="false" />
            </div>
            <p class="muted small">tcpdump 命令行参数，默认 <code>-p -vv -s 0 -w</code>；输出路径（-w）始终由软件按「设备_时间_随机」规则生成，这里写的 -w 值会被忽略，避免文件名失控。</p>
            <label class="switch-row">
              <input type="checkbox" v-model="cfg.captureAsRoot" @change="saveCfg" />
              <span>以 root 运行 tcpdump（su -c 提权）</span>
            </label>
            <p class="muted small">默认关闭，tcpdump 以普通 shell 身份运行。部分设备 adbd 非 root、tcpdump 无权限抓包（报 permission 错误）时，开启此项用 <code>su -c</code> 仅给 tcpdump 提权（不重启整个 adbd）。前提是设备已 root 且存在 <code>su</code>。</p>
            <div class="outdir-row">
              <span class="outdir-label">生成包文件路径</span>
              <input class="outdir-input" v-model="cfg.captureDeviceDir" @change="saveCfg" spellcheck="false" />
            </div>
            <p class="muted small">设备端抓包落盘目录（Android 路径），默认 <code>/sdcard/adbpp_captures/</code>；新抓包写到该目录。改后即时生效，下次抓包落到新目录。</p>
            <div class="outdir-row">
              <span class="outdir-label">本机保存目录</span>
              <input class="outdir-input" :value="cfg.captureLocalDir" readonly />
              <button class="outdir-btn" @click="browseCaptureLocalDir">浏览…</button>
            </div>
            <p class="muted small">点「下载」时 pcap 拉到本机该目录；为空则落到 <code>{{ cfg.outDir }}/captures</code>。</p>
          </div>
          <div v-if="settingsTab === 'shot'" class="shot-box">
            <div class="outdir-row">
              <span class="outdir-label">截图保存目录</span>
              <input class="outdir-input" :value="cfg.screenshotDir" readonly />
              <button class="outdir-btn" @click="browseScreenshotDir">浏览…</button>
            </div>
            <p class="muted small">「截图到路径」与「开始/停止截图」的落盘目录（默认 adb++.exe 所在目录）。截图文件名形如 <code>screenshot_YYYYMMDDHHMMSS_&lt;设备序列号&gt;.png</code>，每图一个文件便于按时间排序。</p>
            <label class="switch-row">
              <span>截图间隔</span>
              <input type="number" min="200" max="60000" step="100" v-model.number="cfg.screenshotInterval" @change="saveCfg" />
              <span class="muted small">毫秒（200~60000，默认 1000，即每 1 秒 1 张）</span>
            </label>
            <p class="muted small">仅「开始/停止截图」连续模式使用此间隔；「截图到路径」为单次立即截图，不受此值影响。</p>
          </div>
        </div>
      </div>
      <div class="modal-foot"><button class="primary" @click="settingsOpen = false">关闭</button></div>
    </div>
  </div>
</template>
