// 共享状态：APK（已装应用列表 / 解析弹窗）
import { ref, computed } from 'vue'

export const apkModalView = ref('none')   // none | list | info

export const pkgs = ref([])

export const apkInfo = ref('')

export const apkMsg = ref('')

export const apkFilter = ref('')

export const pkgsFiltered = computed(() => {
  const q = apkFilter.value.trim().toLowerCase()
  if (!q) return pkgs.value
  return pkgs.value.filter((p) => (p.pkg || '').toLowerCase().includes(q))
})
