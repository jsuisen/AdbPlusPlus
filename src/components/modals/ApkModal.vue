<script setup>
// APK 解析弹窗：已装应用列表选择 / 解析结果展示
import * as State from '@/composables/state'
import { maskClose } from '@/composables/useConfig'
import { closeApkModal, parseInstalledPick } from '@/composables/useApk'
import { t } from '@/i18n'

const { apkModalView, apkFilter, pkgs, pkgsFiltered, apkInfo, apkMsg } = State
</script>

<template>
  <div v-if="apkModalView !== 'none'" class="modal-mask" @click.self="maskClose(closeApkModal)">
    <div class="modal apk-modal">
      <div class="modal-head">
        {{ apkModalView === 'list' ? t('apk.selectInstalled') : t('apk.result') }}
        <button class="modal-x" @click="closeApkModal">×</button>
      </div>
      <div class="modal-body">
        <div v-if="apkModalView === 'list'" class="apk-search">
          <input class="apk-filter" v-model="apkFilter" :placeholder="t('apk.filterPlaceholder', { n: pkgs.length })" />
          <button class="qf-clear" type="button" @click="apkFilter = ''" :title="t('apk.clearFilter')">×</button>
        </div>
        <table v-if="apkModalView === 'list'" class="apktbl">
          <thead><tr><th>{{ t('modal.package') }}</th><th>{{ t('file.devicePath') }}</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in pkgsFiltered" :key="p.pkg">
              <td>{{ p.pkg }}</td><td class="muted">{{ p.path }}</td>
              <td><button @click="parseInstalledPick(p)">{{ t('common.parse') }}</button></td>
            </tr>
            <tr v-if="!pkgsFiltered.length"><td colspan="3" class="muted">{{ t('apk.noPackage') }}</td></tr>
          </tbody>
        </table>
        <pre v-else class="apkinfo">{{ apkInfo || apkMsg }}</pre>
      </div>
      <div class="modal-foot"><button class="primary" @click="closeApkModal">{{ t('common.close') }}</button></div>
    </div>
  </div>
</template>
