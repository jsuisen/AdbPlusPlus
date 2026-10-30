<script setup>
// 组件调试弹窗：启动 Activity / 启动Service / 停止Service / 发送广播（含 Extra 参数与实时 adb 命令预览）
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import {
  addExtra, removeExtra, closeActModal, runActActivity, runActService, runActBroadcast,
  saveActCfg, loadActCfg, copyActCmd
} from '@/composables/useDeviceinfo'

const {
  actModalOpen, actModalType, actPkg, actActivity, actAction, actService,
  actServiceBackground, actComponent, actFlags, actExtras, actCmdPreview
} = State
</script>

<template>
  <div v-if="actModalOpen" class="modal-mask" @click.self="maskClose(closeActModal)">
    <div class="modal act-modal">
      <div class="modal-head">
        {{ actModalType === 'activity' ? '启动 Activity' : actModalType === 'startService' ? '启动 Service' : actModalType === 'stopService' ? '停止 Service' : '发送广播' }}
        <div class="modal-head-acts">
          <button class="ghost" @click="loadActCfg">加载</button>
          <button class="ghost" @click="saveActCfg">保存</button>
          <button class="modal-x" @click="closeActModal">×</button>
        </div>
      </div>
      <div class="modal-body">
        <label>包名<input v-model="actPkg" placeholder="com.example.app" style="width:100%" /></label>
        <template v-if="actModalType === 'activity'">
          <label>Activity 类名<input v-model="actActivity" placeholder=".MainActivity" style="width:100%" /></label>
          <label>Action（隐式启动填此，留空则用包名+类）<input v-model="actAction" placeholder="android.intent.action.DIAL" style="width:100%" /></label>
        </template>
        <template v-if="actModalType === 'startService' || actModalType === 'stopService'">
          <label>Service 类名<input v-model="actService" placeholder=".MyService" style="width:100%" /></label>
          <template v-if="actModalType === 'startService'">
            <label class="switch-row"><input type="checkbox" v-model="actServiceBackground" /><span>是否后台 service（不勾则以前台 service 启动，API26+）</span></label>
          </template>
        </template>
        <template v-if="actModalType === 'broadcast'">
          <label>Action<input v-model="actAction" placeholder="com.example.MY_ACTION" style="width:100%" /></label>
          <label>目标组件（可选，填 .Xxx 需先填上方包名）<input v-model="actComponent" placeholder="com.example.app/.MyReceiver" style="width:100%" /></label>
        </template>
        <div class="extras-box" v-if="actModalType !== 'stopService'">
          <div class="info-label">Extra 参数</div>
          <div v-for="(e, i) in actExtras" :key="i" class="extras-row">
            <input v-model="e.key" placeholder="key" style="flex:1" />
            <input v-model="e.value" placeholder="value" style="flex:1" />
            <select v-model="e.type" style="width:108px; flex:none">
              <option value="es">es(字符串)</option><option value="ei">ei(整数)</option><option value="ez">ez(布尔)</option><option value="ef">ef(浮点数)</option><option value="el">el(长整数)</option>
            </select>
            <button class="x-btn" @click="removeExtra(i)">×</button>
          </div>
          <button class="link-btn" @click="addExtra">+ 添加 Extra</button>
        </div>
        <template v-if="actModalType === 'broadcast'">
          <label>Flags（可选）<input v-model="actFlags" placeholder="0x01000000（前台广播）" style="width:100%" /></label>
        </template>

        <!-- 实时 adb 命令预览 -->
        <div class="cmd-preview">
          <div class="info-label">对应 adb 命令（实时，只读）<button class="link-btn" @click="copyActCmd">复制</button></div>
          <textarea class="cmd-text" readonly :value="actCmdPreview" rows="3"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closeActModal">取消</button>
        <template v-if="actModalType === 'activity'"><button class="primary" @click="runActActivity">启动</button></template>
        <template v-else-if="actModalType === 'startService'"><button class="primary" @click="runActService('start')">启动</button></template>
        <template v-else-if="actModalType === 'stopService'"><button class="danger" @click="runActService('stop')">停止</button></template>
        <template v-else><button class="primary" @click="runActBroadcast">发送</button></template>
      </div>
    </div>
  </div>
</template>
