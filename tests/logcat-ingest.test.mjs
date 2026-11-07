import test from 'node:test'
import assert from 'node:assert/strict'
import { createLineReader, createIngestState, ingestLines, parseLine } from '../main/logcat-ingest.js'

const LINE = (msg) => `11-07 12:00:00.000  100  200 I MyTag: ${msg}\n`

test('跨 chunk UTF-8 不产生替换字符', () => {
  const full = Buffer.from(LINE('中文日志'))
  const cut = full.indexOf(Buffer.from('中')) + 1   // 切在「中」的三字节中间
  assert.ok(cut > 0 && cut < full.length)
  const reader = createLineReader()
  const lines = [...reader.feed(full.subarray(0, cut)), ...reader.feed(full.subarray(cut))]
  assert.equal(lines.length, 1)
  const parsed = parseLine(lines[0])
  assert.equal(parsed.msg, '中文日志')
  assert.ok(!parsed.msg.includes('\uFFFD'))
})

test('一行日志跨 chunk 不被劈成半行 + 折行', () => {
  const full = Buffer.from(LINE('hello world'))
  const cut = Math.floor(full.length / 2)
  const reader = createLineReader()
  const lines = [...reader.feed(full.subarray(0, cut)), ...reader.feed(full.subarray(cut))]
  assert.equal(lines.length, 1)
  assert.equal(parseLine(lines[0]).msg, 'hello world')
})

test('同一 flush 窗口内折行只追加一次（旧实现会显示两遍）', () => {
  const state = createIngestState(100)
  ingestLines(state, [
    LINE('start').trimEnd(),
    '  at Foo.bar(Foo.java:1)',
    '  at Baz.qux(Baz.java:2)'
  ])
  assert.equal(state.pending.length, 1)
  assert.equal(state.buffer.length, 1)
  assert.equal((state.pending[0].msg.match(/Foo\.bar/g) || []).length, 1)
  assert.equal((state.pending[0].msg.match(/Baz\.qux/g) || []).length, 1)
})

test('flush 之后的续行独立成行且内容不丢', () => {
  const state = createIngestState(100)
  ingestLines(state, [LINE('start').trimEnd()])
  state.pending = []   // 模拟 flush 已推送并清空 pending
  const added = ingestLines(state, ['  at Foo.bar(Foo.java:1)'])
  assert.equal(added, 1)
  assert.equal(state.pending.length, 1)
  assert.equal(state.pending[0].msg, '  at Foo.bar(Foo.java:1)')
  assert.equal(state.pending[0].tag, 'MyTag')   // 元数据继承，过滤/着色不失真
  assert.equal(state.pending[0].level, 'I')
  assert.equal(state.buffer.length, 2)
})

test('空行被忽略，ActivityManager 进程事件只触发一次', () => {
  const state = createIngestState(100)
  let hits = 0
  ingestLines(state, [
    '',
    '11-07 12:00:01.000  1  2 I ActivityManager: Start proc 123:com.foo/u0a1 for activity',
    '',
    '  continuation'
  ], () => { hits++ })
  assert.equal(hits, 1)
  assert.equal(state.pending.length, 1)
  assert.ok(state.pending[0].msg.includes('continuation'))
})
