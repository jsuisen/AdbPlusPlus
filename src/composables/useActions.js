// 由 split_app2.cjs 自动拆分生成（actions）
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { t, tKeycode } from '@/i18n'
import {INPUT_TYPES, INPUT_VALUE_FIELDS, NO_GROUP, api, appPkg, cfg, cmdModal, cmdModalOpen, cmdOutput, fileLocal, fileModalMode, fileModalOpen, fileRemote, filteredKeycodes, inputButtons, inputModalOpen, inputModalType, installModalOpen, installOpts, keyButtons, monkeyCount, monkeyModalOpen, monkeyPkg, monkeySeed, monkeyThrottle, newCmdArgs, newCmdGroup, newCmdIgnore, newCmdName, newInputGroup, newInputName, newInputVal, newKeyGroup, newKeyName, newKeyValue, permModalOpen, permMode, permName, permPkg, devInvoke, quickCommands, rebootModalOpen, rebootMode, selectedSerial, swipeButtons, tapButtons, textButtons, uninstallKeep, uninstallModalOpen, beginBusy, cmdDetail, endBusy, showResult} from './state'
import { saveCfg } from './useConfig'
import { toast } from './useUi'


function addCmd() {
  const name = newCmdName.value.trim()
  const args = newCmdArgs.value.trim().split(/\s+/).filter(Boolean)
  if (!name || !args.length) return
  const group = newCmdGroup.value.trim() || NO_GROUP
  quickCommands.value.push({ name, args, group, ignoreResponse: newCmdIgnore.value })
  newCmdName.value = ''; newCmdArgs.value = ''; newCmdGroup.value = ''; newCmdIgnore.value = false
  saveCfg()
}

function removeCmd(i) { quickCommands.value.splice(i, 1); saveCfg() }

async function runCmd(c) {
  const cmd = `$ ${c.args.join(' ')}`
  try {
    // 命令本身即 adb 参数，不再额外拼 "adb" 前缀
    // 注意：c.args 是 Vue 响应式代理，Electron IPC(V8 序列化) 无法克隆 Proxy，
    // 必须转成普通数组再传，否则报 “An object could not be cloned.”
    const r = await api.invoke('adb:run', [...c.args])
    const body = `[exit ${r.code}]\n${r.out}${r.err}`
    const full = `${cmd}\n\n${body}`
    if (c.ignoreResponse) toast(r.code === 0 ? t('toast.execSuccess') : t('toast.execFailed') + (r.err || r.code))
    else { cmdOutput.value = full; openCmdModal(cmd, body, full) }
  } catch (e) {
    const body = `${t('toast.execFailed')}${e.message}`
    const full = `${cmd}\n\n${body}`
    if (c.ignoreResponse) toast(t('toast.execFailed') + e.message)
    else { cmdOutput.value = full; openCmdModal(cmd, body, full) }
  }
}

function closeCmdOutput() { cmdOutput.value = '' }

function onCmdColor(i, val) { if (quickCommands.value[i]) { quickCommands.value[i].color = val; saveCfg() } }

function onCmdArgsInput(i, val) {
  if (!quickCommands.value[i]) return
  quickCommands.value[i].args = val.trim().split(/\s+/).filter(Boolean)
  saveCfg()
}

function cmdTextColor(bg) {
  if (!bg) return ''
  const m = /^#?([0-9a-fA-F]{6})$/.exec(bg)
  if (!m) return ''
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r < 128 && g < 128 && b < 128) ? '#fff' : '#000'
}

function openCmdModal(cmd, body, full) {
  cmdModal.cmd = cmd
  cmdModal.body = body
  cmdModal.full = full
  cmdModalOpen.value = true
}

async function copyCmdOutput() {
  try {
    await navigator.clipboard.writeText(cmdModal.full)
    toast(t('toast.copiedOutput'))
  } catch { toast(t('toast.copyFailed')) }
}

async function saveCmdOutput() {
  const path = await api.invoke('file:saveText', {
    content: cmdModal.full,
    defaultPath: (cfg.value.outDir || '') + '/cmd_output.log',
    filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
  })
  if (path) toast(t('toast.saved') + path)
}

function addKey() {
  const name = newKeyName.value.trim()
  const key = newKeyValue.value.trim()
  if (!name || !key) return
  const group = newKeyGroup.value.trim() || NO_GROUP
  keyButtons.value.push({ name, key, group })
  newKeyName.value = ''; newKeyValue.value = ''; newKeyGroup.value = ''
  saveCfg()
}

function removeKey(i) { keyButtons.value.splice(i, 1); saveCfg() }

function onKeyColor(i, val) { if (keyButtons.value[i]) { keyButtons.value[i].color = val; saveCfg() } }

async function runKey(k) {
  // devInvoke 已带 serial；未选设备时给出提示并中止
  if (!selectedSerial.value) { showResult(t('action.inputKey'), t('err.noDevice'), false); return }
  await devInvoke(t('action.inputKey'), 'adb:inputKey', { key: k.key })
}

async function copyKeycodeTable() {
  const rows = [[t('keyref.value'), t('common.name'), t('keyref.desc')]]
  filteredKeycodes.value.forEach(r => rows.push([r.value, r.name, tKeycode(r.name)]))
  const text = rows.map(r => r.join('\t')).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    toast(t('toast.copiedPrefix') + (rows.length - 1) + t('toast.copiedSuffix'))
  } catch {
    toast(t('toast.copyTableFailed'))
  }
}

function inputButtonsOf(t) { return t === 'text' ? textButtons.value : t === 'tap' ? tapButtons.value : swipeButtons.value }

function openInputModal(t) { inputModalType.value = t; inputModalOpen.value = true }

function addInput() {
  const name = newInputName.value.trim()
  if (!name) return
  const t = inputModalType.value
  const val = {}
  for (const f of INPUT_VALUE_FIELDS[t]) {
    const raw = (newInputVal[f.prop] ?? '').toString().trim()
    if (!raw) {
      if (f.optional) continue   // 可选字段（滑动时长）留空则不写入
      return                      // 必填字段缺失则不动（简单够用）
    }
    val[f.prop] = f.type === 'num' ? Number(raw) : raw
  }
  const group = newInputGroup.value.trim() || NO_GROUP
  inputButtonsOf(t).push({ name, group, ...val })
  newInputName.value = ''; newInputGroup.value = ''
  for (const f of INPUT_VALUE_FIELDS[t]) newInputVal[f.prop] = ''
  saveCfg()
}

function removeInput(i) { inputButtons.value.splice(i, 1); saveCfg() }

function onInputColor(i, val) { if (inputButtons.value[i]) { inputButtons.value[i].color = val; saveCfg() } }

async function runInput(k) {
  const t = inputModalType.value
  if (!selectedSerial.value) { showResult(t(INPUT_TYPES[t].titleKey), t('err.noDevice'), false); return }
  await devInvoke(t(INPUT_TYPES[t].titleKey), INPUT_TYPES[t].channel, INPUT_TYPES[t].build(k))
}

function closePermModal() { permModalOpen.value = false }

async function runPerm() {
  if (!selectedSerial.value) { toast(t('err.selectDevice')); return }
  await devInvoke(permMode.value === 'grant' ? t('perm.grant') : t('perm.revoke'), permMode.value === 'grant' ? 'adb:grant' : 'adb:revoke', { pkg: permPkg.value, perm: permName.value })
  closePermModal()
}

function resetFileForm() { fileLocal.value = ''; fileRemote.value = '' }

async function choosePushFile() {
  const p = await api.invoke('file:openFile', {})
  if (p) fileLocal.value = p
}

async function runFile() {
  if (!selectedSerial.value) { toast(t('err.selectDevice')); return }
  try {
    let title, ok, text
    if (fileModalMode.value === 'push') {
      if (!fileLocal.value || !fileRemote.value.trim()) { toast(t('err.selectLocalAndPath')); return }
      const r = await api.invoke('adb:push', { serial: selectedSerial.value, local: fileLocal.value, remote: fileRemote.value.trim() })
      ok = r.code === 0; title = t('file.push')
      text = (ok ? t('toast.pushDone') + fileRemote.value.trim() : t('toast.pushFailed') + (r.err || r.code)) + '\n' + cmdDetail(r)
    } else {
      if (!fileRemote.value.trim()) { toast(t('err.inputDevicePath')); return }
      const local = await api.invoke('file:pickSave', { defaultPath: (cfg.value.outDir || '') + '/pull.bin', filters: [{ name: 'All', extensions: ['*'] }] })
      if (!local) return
      const r = await api.invoke('adb:pull', { serial: selectedSerial.value, remote: fileRemote.value.trim(), local })
      ok = r.code === 0; title = t('file.pull')
      text = (ok ? t('toast.pullDone') + local : t('toast.pullFailed') + (r.err || r.code)) + '\n' + cmdDetail(r)
    }
    fileModalOpen.value = false
    showResult(title, text, ok)
  } catch (e) { showResult(t('modal.fileTransfer'), t('toast.fileTransferError') + e.message, false) }
}

function closeRebootModal() { rebootModalOpen.value = false }

async function runReboot() {
  if (!selectedSerial.value) { toast(t('err.selectDevice')); return }
  await devInvoke(t('action.reboot'), 'adb:reboot', { mode: rebootMode.value })
  closeRebootModal()
}

function closeMonkeyModal() { monkeyModalOpen.value = false }

async function runMonkey() {
  if (!selectedSerial.value) { toast(t('err.selectDevice')); return }
  await devInvoke('Monkey', 'adb:monkey', { pkg: monkeyPkg.value, seed: monkeySeed.value, throttle: monkeyThrottle.value, count: monkeyCount.value })
  closeMonkeyModal()
}

function openInstallModal() { installModalOpen.value = true }

async function confirmInstall() {
  if (!selectedSerial.value) { showResult(t('install.title'), t('err.noDevice'), false); return }
  const apkPath = await api.invoke('file:openFile', { filters: [{ name: 'APK', extensions: ['apk'] }] })
  if (!apkPath) return
  const opts = []
  if (installOpts.d) opts.push('-d')
  if (installOpts.g) opts.push('-g')
  if (installOpts.t) opts.push('-t')
  const args = ['-s', selectedSerial.value, 'install', '-r', ...opts, apkPath]
  const cmd = 'adb ' + args.join(' ')
  // 先关配置弹窗、再起后台安装：安装期间不存在 modal-mask，其余界面元素始终可点击/滚动。
  // 进度只由 BusyIndicator 的 pointer-events:none 小浮层呈现。
  installModalOpen.value = false
  beginBusy(t('busy.installing'))
  try {
    const r = await api.invoke('adb:run', args)
    const ok = r.code === 0
    const text = (ok ? t('toast.installDone') + apkPath : t('toast.installFailed') + (r.err || r.code)) + '\n' + cmdDetail(r, cmd)
    showResult(t('install.title'), text, ok)
  } catch (e) {
    showResult(t('install.title'), t('toast.installError') + e.message + '\n$ ' + cmd, false)
  } finally {
    endBusy()
  }
}

function openUninstallModal() { uninstallModalOpen.value = true }

async function confirmUninstall() {
  if (!selectedSerial.value || !appPkg.value) { toast(t('err.inputPkg')); return }
  const args = ['-s', selectedSerial.value, 'shell', 'pm', 'uninstall']
  if (uninstallKeep.value) args.push('-k')
  args.push(appPkg.value)
  try {
    const r = await api.invoke('adb:run', args)
    const ok = r.code === 0
    const text = (ok ? t('toast.uninstallDonePrefix') + (uninstallKeep.value ? t('uninstall.keep') : t('uninstall.clear')) + '）：' + appPkg.value : t('toast.uninstallFailed') + (r.err || r.code)) + '\n' + cmdDetail(r, 'adb ' + args.join(' '))
    uninstallModalOpen.value = false
    showResult(t('uninstall.title'), text, ok)
  } catch (e) { showResult(t('uninstall.title'), t('toast.uninstallError') + e.message, false) }
}

export function useActions() {

  return { addCmd, addInput, addKey, choosePushFile, closeCmdOutput, closeMonkeyModal, closePermModal, closeRebootModal, cmdTextColor, confirmInstall, confirmUninstall, copyCmdOutput, copyKeycodeTable, inputButtonsOf, onCmdArgsInput, onCmdColor, onInputColor, onKeyColor, openCmdModal, openInputModal, openInstallModal, openUninstallModal, removeCmd, removeInput, removeKey, resetFileForm, runCmd, runFile, runInput, runKey, runMonkey, runPerm, runReboot, saveCmdOutput }
}
export { addCmd, addInput, addKey, choosePushFile, closeCmdOutput, closeMonkeyModal, closePermModal, closeRebootModal, cmdTextColor, confirmInstall, confirmUninstall, copyCmdOutput, copyKeycodeTable, inputButtonsOf, onCmdArgsInput, onCmdColor, onInputColor, onKeyColor, openCmdModal, openInputModal, openInstallModal, openUninstallModal, removeCmd, removeInput, removeKey, resetFileForm, runCmd, runFile, runInput, runKey, runMonkey, runPerm, runReboot, saveCmdOutput }