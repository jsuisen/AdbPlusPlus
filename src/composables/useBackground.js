// 自定义背景：配置 -> CSS 变量。图片只在启动/选择时解码一次，日志热路径不参与。
import { api, cfg } from './state'
import { toast } from './useUi'
import { t } from '@/i18n'

let imageUrl = ''
let loadSeq = 0

function zone(key) {
  const z = cfg.value.bgZones && cfg.value.bgZones[key]
  return z || { enabled: false, color: '', alpha: 100 }
}

function normalizeHex(val) {
  let h = String(val == null ? '' : val).trim()
  if (/^#?[0-9a-fA-F]{3}$/.test(h)) {
    h = h.replace(/^#/, '').split('').map(c => c + c).join('')
  } else if (/^#?[0-9a-fA-F]{6}$/.test(h)) {
    h = h.replace(/^#/, '')
  } else {
    return ''
  }
  return '#' + h.toLowerCase()
}

function hexToRgba(hex, alpha) {
  const h = normalizeHex(hex)
  if (!h) return null
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  let a = Number(alpha)
  if (!Number.isFinite(a)) a = 100
  a = Math.max(0, Math.min(100, Math.round(a))) / 100
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// 写变量是唯一渲染入口；配置变更、主题空色回退、图片加载完成都走这里。
function applyBackground() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const on = !!cfg.value.bgEnabled
  root.style.setProperty('--app-bg-image', (on && imageUrl) ? `url("${imageUrl}")` : 'none')
  const zones = [
    ['chrome', '--zone-chrome-bg', 'var(--panel)'],
    ['log', '--zone-log-bg', 'var(--surface)']
  ]
  for (const [key, varName, fallback] of zones) {
    const z = zone(key)
    let value = null
    if (on && z.enabled) {
      let a = Number(z.alpha)
      if (!Number.isFinite(a)) a = 100
      a = Math.max(0, Math.min(100, Math.round(a)))
      // 空颜色 = 跟随主题 token；带上 alpha 时必须混透明，否则回退成不透明色，透明度看不出效果。
      value = z.color ? hexToRgba(z.color, a) : `color-mix(in srgb, ${fallback} ${a}%, transparent)`
    }
    root.style.setProperty(varName, value || fallback)
  }
}

async function loadImage(p, quiet = false) {
  const seq = ++loadSeq
  if (!p) {
    imageUrl = ''
    applyBackground()
    return false
  }
  let url = null
  try {
    url = await api.invoke('file:readImage', { path: p })
  } catch (e) {
    console.warn('[background] image read failed', e)
  }
  if (seq !== loadSeq) return false
  imageUrl = typeof url === 'string' ? url : ''
  applyBackground()
  if (!imageUrl && !quiet) toast(t('toast.bgFailed'))
  return !!imageUrl
}

async function restoreBackground() {
  applyBackground()
  if (!cfg.value.bgImage) return
  await loadImage(cfg.value.bgImage, true)
}

async function browseBackgroundImage() {
  const p = await api.invoke('file:openFile', {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  })
  if (!p) return
  const ok = await loadImage(p)
  if (!ok) return
  cfg.value.bgImage = p
  applyBackground()
}

function clearBackgroundImage() {
  cfg.value.bgImage = ''
  loadSeq++
  imageUrl = ''
  applyBackground()
}

function setZoneColor(key, val) {
  const z = zone(key)
  const raw = String(val == null ? '' : val).trim()
  const hex = normalizeHex(raw)
  if (raw && !hex) return
  z.color = hex
  applyBackground()
}

function setZoneAlpha(key, val) {
  const z = zone(key)
  let a = Number(val)
  if (!Number.isFinite(a)) a = 100
  z.alpha = Math.max(0, Math.min(100, Math.round(a)))
  applyBackground()
}

function resetBackground() {
  cfg.value.bgEnabled = false
  cfg.value.bgImage = ''
  cfg.value.bgZones = {
    chrome: { enabled: false, color: '', alpha: 100 },
    log: { enabled: false, color: '', alpha: 100 }
  }
  clearBackgroundImage()
}

function useBackground() {
  return {
    applyBackground, browseBackgroundImage, clearBackgroundImage, loadImage,
    resetBackground, restoreBackground, setZoneAlpha, setZoneColor
  }
}

export {
  applyBackground, browseBackgroundImage, clearBackgroundImage, loadImage,
  resetBackground, restoreBackground, setZoneAlpha, setZoneColor, useBackground
}
