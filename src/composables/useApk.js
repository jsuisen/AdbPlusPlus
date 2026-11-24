// 由 split_app2.cjs 自动拆分生成（apk）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t } from '@/i18n'
import {api, apkInfo, apkModalView, apkMsg, beginBusy, cfg, cmdDetail, endBusy, pkgs, selectedSerial, showResult} from './state'
import { sortPkgs } from './shared'

// 与侧边栏「安装APK」(InstallModal -> confirmInstall) 保持同一套「非阻断进度 + 结果弹窗」语义
async function installApk() {
  if (!selectedSerial.value) { showResult(t('install.title'), t('err.noDevice'), false); return }
  const apkPath = await api.invoke('file:openFile', { filters: [{ name: 'APK', extensions: ['apk'] }] })
  if (!apkPath) return
  const cmd = 'adb -s ' + selectedSerial.value + ' install -r ' + apkPath
  beginBusy(t('busy.installing'))
  try {
    const r = await api.invoke('adb:install', { serial: selectedSerial.value, apkPath })
    const ok = r.code === 0
    showResult(t('install.title'), (ok ? t('toast.installDone') + apkPath : t('toast.installFailed') + (r.err || r.code)) + '\n' + cmdDetail(r, cmd), ok)
  } catch (e) {
    showResult(t('install.title'), t('toast.installError') + e.message + '\n$ ' + cmd, false)
  } finally {
    endBusy()
  }
}

async function openParse(apkPath) {
  try {
    const info = await api.invoke('apk:parse', { apkPath })
    apkInfo.value = JSON.stringify(info, null, 2)
    apkMsg.value = t('toast.parsed') + apkPath
  } catch (e) {
    apkInfo.value = ''
    apkMsg.value = t('toast.parseFailed') + e.message
  }
  apkModalView.value = 'info'
}

async function parseLocal() {
  const p = await api.invoke('file:openFile', { filters: [{ name: 'APK', extensions: ['apk'] }] })
  if (p) await openParse(p)
}

async function parseInstalled() {
  if (!selectedSerial.value) { showResult(t('action.parseInstalled'), t('err.noDevice'), false); return }
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
    apkMsg.value = t('toast.parsed') + outPath
  } catch (e) {
    apkInfo.value = ''
    apkMsg.value = t('toast.parseFailed') + e.message
  }
  apkModalView.value = 'info'
}

function closeApkModal() { apkModalView.value = 'none' }

export function useApk() {

  return { closeApkModal, installApk, openParse, parseInstalled, parseInstalledPick, parseLocal }
}
export { closeApkModal, installApk, openParse, parseInstalled, parseInstalledPick, parseLocal }