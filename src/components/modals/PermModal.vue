<script setup>
// 权限授予/撤销弹窗
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closePermModal, runPerm } from '@/composables/useActions'

const { permModalOpen, permMode, permPkg, permName } = State
</script>

<template>
  <div v-if="permModalOpen" class="modal-mask" @click.self="maskClose(closePermModal)">
    <div class="modal">
      <div class="modal-head">{{ permMode === 'grant' ? '授予权限' : '撤销权限' }}<button class="modal-x" @click="closePermModal">×</button></div>
      <div class="modal-body">
        <label>包名<input v-model="permPkg" placeholder="com.example.app" style="width:100%" /></label>
        <label>权限名<input v-model="permName" placeholder="android.permission.CAMERA" style="width:100%" /></label>
      </div>
      <div class="modal-foot">
        <button class="ghost" @click="closePermModal">取消</button>
        <button :class="permMode === 'grant' ? 'primary' : 'danger'" @click="runPerm">{{ permMode === 'grant' ? '授予' : '撤销' }}</button>
      </div>
    </div>
  </div>
</template>
