// 由 split_app2.cjs 自动拆分生成（apk）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {api, apkInfo, apkModalView, apkMsg, cfg, lastMsg, pkgs, selectedSerial} from './state'
import { sortPkgs } from './shared'

async function installApk() {
  if (!selectedSerial.value) { lastMsg.value = '未选择设备'; return }
  const apkPath = await api.invoke('file:openFile', { filters: [{ name: 'APK', extensions: ['apk'] }] })
  if (!apkPath) return
  try {
    const r = await api.invoke('adb:install', { serial: selectedSerial.value, apkPath })
    lastMsg.value = r.code === 0 ? '安装完成：' + apkPath : '安装失败：' + (r.err || r.code)
  } catch (e) { lastMsg.value = '安装异常：' + e.message }
}

async function openParse(apkPath) {
  try {
    const info = await api.invoke('apk:parse', { apkPath })
    apkInfo.value = JSON.stringify(info, null, 2)
    apkMsg.value = '已解析：' + apkPath
  } catch (e) {
    apkInfo.value = ''
    apkMsg.value = '解析失败：' + e.message
  }
  apkModalView.value = 'info'
}

async function parseLocal() {
  const p = await api.invoke('file:openFile', { filters: [{ name: 'APK', extensions: ['apk'] }] })
  if (p) await openParse(p)
}

async function parseInstalled() {
  if (!selectedSerial.value) { lastMsg.value = '未选择设备'; return }
  // 已装应用列表同样按 sortPkgs 排序（android./com.android. 系统类沉底，其余升序），与进程包名下拉框一致
  pkgs.value = sortPkgs(await api.invoke('apk:list', { serial: selectedSerial.value }))
  apkModalView.value = 'list'
}

async function parseInstalledPick(p) {
  const outPath = (cfg.value.outDir || '') + '/' + p.pkg.replace(/[^a-z0-9._]/gi, '_') + '.apk'
  try {
    await api.invoke('apk:pull', { serial: selectedSerial.value, pkgPath: p.path, outPath })
    const info = await api.invoke('apk:parse', { apkPath: outPath })
    apkInfo.value = JSON.stringify(info, null, 2)
    apkMsg.value = '已解析：' + outPath
  } catch (e) {
    apkInfo.value = ''
    apkMsg.value = '解析失败：' + e.message
  }
  apkModalView.value = 'info'
}

function closeApkModal() { apkModalView.value = 'none' }

export function useApk() {

  return { closeApkModal, installApk, openParse, parseInstalled, parseInstalledPick, parseLocal }
}
export { closeApkModal, installApk, openParse, parseInstalled, parseInstalledPick, parseLocal }