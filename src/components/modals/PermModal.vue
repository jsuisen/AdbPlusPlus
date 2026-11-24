<script setup>
// 权限授予/撤销弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closePermModal, runPerm } from '@/composables/useActions'
import { t } from '@/i18n'

const { permModalOpen, permMode, permPkg, permName } = State
</script>

<template>
  <div v-if="permModalOpen" class="modal-mask" @click.self="maskClose(closePermModal)">
    <div class="modal">
      <div class="modal-head">{{ permMode === 'grant' ? t('perm.grant') : t('perm.revoke') }}<button class="modal-x" @click="closePermModal">×</button></div>
      <div class="modal-body">
        <label>{{ t('modal.package') }}<input v-model="permPkg" placeholder="com.example.app" style="width:100%" /></label>
        <label>{{ t('perm.name') }}<input v-model="permName" placeholder="android.permission.CAMERA" style="width:100%" /></label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closePermModal">{{ t('common.cancel') }}</button>
        <button :class="permMode === 'grant' ? 'primary' : 'danger'" @click="runPerm">{{ permMode === 'grant' ? t('perm.grantShort') : t('perm.revokeShort') }}</button>
      </div>
    </div>
  </div>
</template>
