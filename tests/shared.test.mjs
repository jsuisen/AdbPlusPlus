// shared.js 纯函数单测：node --test tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pad2, ymd, ymdhms, exportTs, escapeRegExp,
  sanitizeSerial, escapeRegexTag, unescapeRegexTag, sortPkgs, fmtMB, fmtRss
} from '../src/composables/shared.js'

test('pad2 两位补零', () => {
  assert.equal(pad2(3), '03')
  assert.equal(pad2(31), '31')
})

test('ymd/ymdhms 本地时间格式化', () => {
  const d = new Date(2026, 8, 30, 7, 5, 3) // 2026-09-30 07:05:03 本地
  assert.equal(ymd(d), '20260930')
  assert.equal(ymdhms(d), '20260930070503')
  assert.match(exportTs(), /^\d{14}$/)
})

test('escapeRegExp 转义全部正则元字符', () => {
  assert.equal(escapeRegExp('a.b*c[d]e(f)g{}h\\i'), 'a\\.b\\*c\\[d\\]e\\(f\\)g\\{\\}h\\\\i')
  const re = new RegExp('^' + escapeRegExp('a.b+c') + '$')
  assert.ok(re.test('a.b+c'))
  assert.ok(!re.test('aXbYc'))
})

test('sanitizeSerial 剔除非法路径字符', () => {
  assert.equal(sanitizeSerial('emulator-5554'), 'emulator-5554')
  assert.equal(sanitizeSerial('192.168.1.10:5555'), '192.168.1.10_5555')
  assert.equal(sanitizeSerial(''), '')
  assert.equal(sanitizeSerial(undefined), '')
})

test('escapeRegexTag/unescapeRegexTag 往返一致', () => {
  for (const tag of ['Test.Tag', 'a|b', 'c\\d', 'x(y)z', '中文Tag']) {
    assert.equal(unescapeRegexTag(escapeRegexTag(tag)), tag)
  }
  // 转义后的 Tag 拼进 | 交替正则必须按字面匹配
  const pat = '^(' + ['A.B', 'C|D'].map(escapeRegexTag).join('|') + ')$'
  assert.ok(new RegExp(pat).test('A.B'))
  assert.ok(new RegExp(pat).test('C|D'))
  assert.ok(!new RegExp(pat).test('AXB'))
})

test('sortPkgs 系统包沉底、其余升序', () => {
  const sorted = sortPkgs([
    { pkg: 'com.example.b' }, { pkg: 'com.android.systemui' }, { pkg: 'com.example.a' }, { pkg: 'android.media' }
  ])
  assert.deepEqual(sorted.map(p => p.pkg), ['com.example.a', 'com.example.b', 'android.media', 'com.android.systemui'])
})

test('fmtMB/fmtRss 换算', () => {
  assert.equal(fmtMB(2 * 1048576), '2.0')
  assert.equal(fmtRss(256), '1.0') // 256 页 × 4096B = 1MB
})
