// createPollingList 行为单测：启停/二次采样/自动刷新/资源清理
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPollingList } from '../src/composables/createPollingList.js'

const ref = (v) => ({ value: v })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function makeList(over = {}) {
  const calls = []
  const L = createPollingList({
    key: 'process',
    list: ref([]),
    running: ref(false),
    auto: ref(false),
    interval: ref(1),
    fetch: (silent) => { calls.push(silent ? 'silent' : 'loud') },
    kickMs: 30,
    onStop: () => { calls.push('stopHook') },
    ...over
  })
  return { L, calls }
}

test('toggle：启动即拉取 + 到期补采一次静默样本；停止清空列表并触发钩子', async () => {
  const { L, calls } = makeList()
  L.toggle()
  assert.equal(L.running.value, true)
  assert.deepEqual(calls, ['loud'])
  await sleep(80) // kickMs=30 → 应补采一次 silent
  assert.ok(calls.includes('silent'), '缺少二次采样: ' + calls)
  L.toggle() // 停止
  assert.equal(L.running.value, false)
  assert.ok(calls.includes('stopHook'))
})

test('停止后补采定时器被取消（不再触发）', async () => {
  const { L, calls } = makeList()
  L.toggle()
  L.toggle() // 立即停止，kick 未到期
  const n = calls.length
  await sleep(80)
  assert.equal(calls.length, n, '停止后仍触发了补采: ' + calls)
})

test('syncAuto：tab 不匹配不轮询；匹配则按间隔轮询，dispose 清理', async () => {
  const tab = ref('process'), serial = ref('emulator-5554')
  // kickMs=0 关闭二次采样，避免干扰轮询计数
  const { L, calls } = makeList({ kickMs: 0 })
  L.toggle()
  L.syncAuto(ref('other-tab'), serial) // tab 不匹配 → 无定时器
  const base = calls.length
  await sleep(80)
  assert.equal(calls.length, base, 'tab 不匹配时不应轮询')
  L.dispose()

  // 条件满足：interval=1s，等待一个周期验证轮询
  const autoCalls = []
  const L3 = createPollingList({
    key: 'process', list: ref([]), running: ref(false), auto: ref(true), interval: ref(1),
    fetch: () => autoCalls.push('auto')
  })
  L3.toggle()
  L3.syncAuto(tab, serial)
  await sleep(1300)
  assert.ok(autoCalls.length >= 1, '条件满足时应按间隔轮询')
  L3.dispose()
  const n = autoCalls.length
  await sleep(100)
  assert.equal(autoCalls.length, n, 'dispose 后仍触发轮询')
})

test('refreshIfRunning：running 时才刷新', () => {
  const { L, calls } = makeList()
  L.refreshIfRunning()
  assert.equal(calls.length, 0)
  L.toggle()
  L.refreshIfRunning()
  assert.ok(calls.includes('loud'))
})
