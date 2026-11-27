<script setup>
// 组件调试弹窗：启动 Activity / 启动Service / 停止Service / 发送广播（含 Extra 参数与实时 adb 命令预览）
import * as State from '@/composables/state'
import AppSelect from '../AppSelect.vue'
import { maskClose } from '@/composables/useConfig'
import {
  addExtra, removeExtra, closeActModal, runActActivity, runActService, runActBroadcast,
  saveActCfg, loadActCfg, copyActCmd
} from '@/composables/useDeviceinfo'
import { t } from '@/i18n'

const {
  actModalOpen, actModalType, actPkg, actActivity, actAction, actService,
  actServiceBackground, actComponent, actFlags, actExtras, actCmdPreview
} = State
</script>

<template>
  <div v-if="actModalOpen" class="modal-mask" @click.self="maskClose(closeActModal)">
    <div class="modal act-modal">
      <div class="modal-head">
        {{ actModalType === 'activity' ? t('act.launchActivity') : actModalType === 'startService' ? t('act.launchService') : actModalType === 'stopService' ? t('act.stopService') : t('act.broadcast') }}
        <div class="modal-head-acts">
          <button class="ghost" @click="loadActCfg">{{ t('common.load') }}</button>
          <button class="ghost" @click="saveActCfg">{{ t('common.save') }}</button>
          <button class="modal-x" @click="closeActModal">×</button>
        </div>
      </div>
      <div class="modal-body">
        <label>{{ t('modal.package') }}<input v-model="actPkg" placeholder="com.example.app" style="width:100%" /></label>
        <template v-if="actModalType === 'activity'">
          <label>{{ t('act.activityClass') }}<input v-model="actActivity" placeholder=".MainActivity" style="width:100%" /></label>
          <label>{{ t('act.actionHint') }}<input v-model="actAction" placeholder="android.intent.action.DIAL" style="width:100%" /></label>
        </template>
        <template v-if="actModalType === 'startService' || actModalType === 'stopService'">
          <label>{{ t('act.serviceClass') }}<input v-model="actService" placeholder=".MyService" style="width:100%" /></label>
          <template v-if="actModalType === 'startService'">
            <label class="switch-row"><input type="checkbox" v-model="actServiceBackground" /><span>{{ t('act.background') }}</span></label>
          </template>
        </template>
        <template v-if="actModalType === 'broadcast'">
          <label>Action<input v-model="actAction" placeholder="com.example.MY_ACTION" style="width:100%" /></label>
          <label>{{ t('act.componentHint') }}<input v-model="actComponent" placeholder="com.example.app/.MyReceiver" style="width:100%" /></label>
        </template>
        <div class="extras-box" v-if="actModalType !== 'stopService'">
          <div class="info-label">{{ t('act.extras') }}</div>
          <div v-for="(e, i) in actExtras" :key="i" class="extras-row">
            <input v-model="e.key" placeholder="key" style="flex:1" />
            <input v-model="e.value" placeholder="value" style="flex:1" />
            <AppSelect v-model="e.type" style="width:108px; flex:none"
                       :options="[{ value: 'es', label: t('act.es') }, { value: 'ei', label: t('act.ei') }, { value: 'ez', label: t('act.ez') }, { value: 'ef', label: t('act.ef') }, { value: 'el', label: t('act.el') }]" />
            <button class="x-btn" @click="removeExtra(i)">×</button>
          </div>
          <button class="link-btn" @click="addExtra">{{ t('act.addExtra') }}</button>
        </div>
        <template v-if="actModalType === 'broadcast'">
          <label>{{ t('act.flags') }}<input v-model="actFlags" :placeholder="t('act.foregroundFlag')" style="width:100%" /></label>
        </template>

        <!-- 实时 adb 命令预览 -->
        <div class="cmd-preview">
          <div class="info-label">{{ t('act.command') }}<button class="link-btn" @click="copyActCmd">{{ t('common.copy') }}</button></div>
          <textarea class="cmd-text" readonly :value="actCmdPreview" rows="3"></textarea>
        </div>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closeActModal">{{ t('common.cancel') }}</button>
        <template v-if="actModalType === 'activity'"><button class="primary" @click="runActActivity">{{ t('common.launch') }}</button></template>
        <template v-else-if="actModalType === 'startService'"><button class="primary" @click="runActService('start')">{{ t('common.launch') }}</button></template>
        <template v-else-if="actModalType === 'stopService'"><button class="danger" @click="runActService('stop')">{{ t('common.stop') }}</button></template>
        <template v-else><button class="primary" @click="runActBroadcast">{{ t('common.send') }}</button></template>
      </div>
    </div>
  </div>
</template>
