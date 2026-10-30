// 轮询检测列表工厂：统一 Service/进程/线程/前台Activity 四个列表的 启停/手动刷新/二次采样/自动刷新定时器 行为。
// 状态 ref 归 state 层所有（state/deviceinfo.js），本工厂只接线行为——与原 useDeviceinfo 中的分支实现一一对应。
// key：主 Tab 名（service/process/thread/activity），自动刷新仅在「该 Tab 激活且 running 且已选设备」时计时。
export function createPollingList({ key, list, running, auto, interval, fetch, kickMs = 0, onStop }) {
  let timer = null
  let kickTimer = null

  function stop() {
    running.value = false
    list.value = []
    if (kickTimer) { clearTimeout(kickTimer); kickTimer = null }
    onStop && onStop()
  }

  function start() {
    running.value = true
    fetch()
    // 进程/线程列表：1.2s 后补采第二次样本，CPU% 才有差值可算
    if (kickMs) kickTimer = setTimeout(() => { if (running.value) fetch(true) }, kickMs)
  }

  function toggle() { running.value ? stop() : start() }

  function refresh() { return fetch() }

  // 切到该 Tab 时若正在检测则立即刷一次（loading 可见）
  function refreshIfRunning() { if (running.value) fetch() }

  function syncAuto(activeMainTab, selectedSerial) {
    if (timer) { clearInterval(timer); timer = null }
    const should = auto.value && running.value && activeMainTab.value === key && selectedSerial.value
    if (should) {
      const sec = Math.max(1, Number(interval.value) || 5)
      timer = setInterval(() => fetch(true), sec * 1000)
    }
  }

  function dispose() {
    if (timer) { clearInterval(timer); timer = null }
    if (kickTimer) { clearTimeout(kickTimer); kickTimer = null }
  }

  return { key, start, stop, toggle, refresh, refreshIfRunning, syncAuto, dispose, running }
}
