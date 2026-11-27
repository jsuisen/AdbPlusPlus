<script setup>
// 路线 C：自绘下拉，替代原生 <select>。弹层 Teleport 到 body，不受任何 overflow 裁剪；
// 全部颜色走 CSS 变量，Windows/macOS/Linux 表现一致（同一份 DOM/CSS，由 Chromium 渲染）。
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  modelValue: { default: '' },
  options: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  title: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'change'])

const rootEl = ref(null)
const menuEl = ref(null)
const open = ref(false)
const activeIdx = ref(-1)
const pos = ref({ left: 0, top: 0, minWidth: 0 })

// 同时接受字符串数组与 { value, label, disabled } 数组，兼容现有全部调用点。
const items = computed(() => props.options.map((o) => {
  if (o && typeof o === 'object') {
    return { value: o.value, label: o.label == null ? String(o.value) : o.label, disabled: !!o.disabled }
  }
  return { value: o, label: String(o), disabled: false }
}))
const currentLabel = computed(() => {
  const hit = items.value.find((o) => o.value === props.modelValue)
  return hit ? hit.label : (props.placeholder || '')
})

async function toggle() {
  if (props.disabled) return
  if (open.value) { open.value = false; return }
  const r = rootEl.value && rootEl.value.getBoundingClientRect()
  if (!r) return
  pos.value = { left: r.left, top: r.bottom + 2, minWidth: r.width }
  activeIdx.value = items.value.findIndex((o) => o.value === props.modelValue)
  open.value = true
  await nextTick()
  const m = menuEl.value
  if (m) {
    const mb = m.getBoundingClientRect()
    if (mb.bottom > window.innerHeight - 8) pos.value.top = Math.max(8, r.top - m.offsetHeight - 2)
  }
}

function pick(o) {
  if (o.disabled) return
  emit('update:modelValue', o.value)
  emit('change', o.value)
  open.value = false
}

function move(delta) {
  const n = items.value.length
  if (!n) return
  let i = activeIdx.value < 0 ? (delta > 0 ? 0 : n - 1) : activeIdx.value
  for (let k = 0; k < n; k++) {
    i = (i + delta + n) % n
    if (!items.value[i].disabled) { activeIdx.value = i; return }
  }
}

function onKey(e) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); toggle()
    }
    return
  }
  if (e.key === 'Escape') { e.preventDefault(); open.value = false; return }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (items.value[activeIdx.value]) pick(items.value[activeIdx.value])
  }
  if (e.key === 'Tab') open.value = false
}

function onDocDown(e) {
  if (!open.value) return
  if (rootEl.value && rootEl.value.contains(e.target)) return
  if (menuEl.value && menuEl.value.contains(e.target)) return
  open.value = false
}
function closeOnScroll() { if (open.value) open.value = false }

onMounted(() => {
  document.addEventListener('mousedown', onDocDown, true)
  window.addEventListener('resize', closeOnScroll)
  window.addEventListener('scroll', closeOnScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocDown, true)
  window.removeEventListener('resize', closeOnScroll)
  window.removeEventListener('scroll', closeOnScroll, true)
})
</script>

<template>
  <div ref="rootEl" class="app-select" :class="{ 'is-disabled': disabled }">
    <button type="button" class="as-trigger" :disabled="disabled" :title="title"
            :aria-expanded="open ? 'true' : 'false'" @click="toggle" @keydown="onKey">
      <span class="as-label">{{ currentLabel }}</span><span class="as-arrow">▾</span>
    </button>
    <Teleport to="body">
      <div v-if="open" ref="menuEl" class="as-menu"
           :style="{ left: pos.left + 'px', top: pos.top + 'px', minWidth: pos.minWidth + 'px' }">
        <div v-for="(o, i) in items" :key="i" class="as-opt"
             :class="{ active: i === activeIdx, selected: o.value === modelValue, 'is-disabled': o.disabled }"
             @mouseenter="activeIdx = i" @click="pick(o)">{{ o.label }}</div>
        <div v-if="!items.length" class="as-empty">—</div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app-select { display: inline-flex; position: relative; max-width: 100%; }
.as-trigger {
  flex: 1 1 auto;
  display: inline-flex; align-items: center; justify-content: space-between; gap: 6px;
  min-width: 0; max-width: 100%; padding: 5px 8px;
  border: 1px solid var(--border); border-radius: 5px;
  background: var(--surface); color: var(--text); font-size: 13px;
}
.as-trigger:hover:not(:disabled) { border-color: var(--primary); }
.as-trigger:focus { outline: none; border-color: var(--primary); }
.as-trigger:disabled { opacity: .5; cursor: not-allowed; }
.app-select.is-disabled { cursor: not-allowed; }
.as-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.as-arrow { flex: 0 0 auto; font-size: 10px; color: var(--muted); }
.as-menu {
  position: fixed; z-index: 1200; max-height: 260px; overflow-y: auto;
  padding: 4px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--panel); box-shadow: 0 8px 26px rgba(0,0,0,.24);
  color: var(--text); font-size: 13px;
}
.as-opt { padding: 5px 10px; border-radius: 4px; white-space: nowrap; cursor: pointer; }
.as-opt.active { background: var(--row-hover); color: var(--text); }
.as-opt.selected { color: var(--primary); font-weight: 600; }
.as-opt.is-disabled { color: var(--muted); cursor: default; }
.as-empty { padding: 5px 10px; color: var(--muted); }
</style>
