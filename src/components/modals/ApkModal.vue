<script setup>
// APK 解析弹窗：已装应用列表选择 / 解析结果展示
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closeApkModal, parseInstalledPick } from '@/composables/useApk'

const { apkModalView, apkFilter, pkgs, pkgsFiltered, apkInfo, apkMsg } = State
</script>

<template>
  <div v-if="apkModalView !== 'none'" class="modal-mask" @click.self="maskClose(closeApkModal)">
    <div class="modal apk-modal">
      <div class="modal-head">
        {{ apkModalView === 'list' ? '选择已装应用解析' : 'APK 解析结果' }}
        <button class="modal-x" @click="closeApkModal">×</button>
      </div>
      <div class="modal-body">
        <div v-if="apkModalView === 'list'" class="apk-search">
          <input class="apk-filter" v-model="apkFilter" placeholder="根据包名过滤（共 {{ pkgs.length }} 个）" />
          <button class="qf-clear" type="button" @click="apkFilter = ''" title="清空过滤框">×</button>
        </div>
        <table v-if="apkModalView === 'list'" class="apktbl">
          <thead><tr><th>包名</th><th>设备路径</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in pkgsFiltered" :key="p.pkg">
              <td>{{ p.pkg }}</td><td class="muted">{{ p.path }}</td>
              <td><button @click="parseInstalledPick(p)">解析</button></td>
            </tr>
            <tr v-if="!pkgsFiltered.length"><td colspan="3" class="muted">无匹配的包名</td></tr>
          </tbody>
        </table>
        <pre v-else class="apkinfo">{{ apkInfo || apkMsg }}</pre>
      </div>
      <div class="modal-foot"><button class="primary" @click="closeApkModal">关闭</button></div>
    </div>
  </div>
</template>
