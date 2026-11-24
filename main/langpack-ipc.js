// i18n 通道：渲染层取语言列表与词条。外部包由主进程扫描，渲染层不碰 fs。
import { ipcMain } from 'electron'
import { I18N_CATALOG, I18N_LOAD } from '../shared/ipc-channels.js'
import { getCatalog, loadLocale } from './i18n.js'

export function registerI18nIpc() {
  ipcMain.handle(I18N_CATALOG, () => getCatalog())
  ipcMain.handle(I18N_LOAD, (_e, payload) => {
    const id = payload && typeof payload.id === 'string' ? payload.id : ''
    const force = !!(payload && payload.force)
    return loadLocale(id, force)
  })
}
