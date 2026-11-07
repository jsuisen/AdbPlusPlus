import test from 'node:test'
import assert from 'node:assert/strict'
import { safeTokens, safeDevicePath, suWrap, sq } from '../main/netcap-safety.js'

test('默认参数与常见过滤表达式通过', () => {
  assert.deepEqual(safeTokens('-p -vv -s 0 -w'), ['-p', '-vv', '-s', '0', '-w'])
  assert.deepEqual(safeTokens('tcp port 80 and host 192.168.1.1'),
    ['tcp', 'port', '80', 'and', 'host', '192.168.1.1'])
  assert.deepEqual(safeTokens(''), [])
})

test('shell 元字符与复杂 BPF 一律拒绝', () => {
  for (const bad of [
    '; rm -rf /sdcard/*', '$(id)', '`id`', 'a|b', 'a&b', 'a>b', 'a<b',
    "a'b", 'a"b', 'a\\b', 'tcp[13] & 2 != 0', 'a#b', 'a~b'
  ]) {
    assert.throws(() => safeTokens('-p ' + bad), /非法字符/, '应拒绝: ' + bad)
  }
})

test('设备路径白名单', () => {
  assert.equal(safeDevicePath('/sdcard/adbpp_captures/a.pcap'), '/sdcard/adbpp_captures/a.pcap')
  assert.equal(safeDevicePath('/sdcard/adbpp_captures/'), '/sdcard/adbpp_captures/')
  for (const bad of [
    '/sdcard/a;rm', '/sdcard/a b', '/sdcard/$(id)', '/sdcard/../x', 'sdcard/x', ''
  ]) {
    assert.throws(() => safeDevicePath(bad), /非法/, '应拒绝: ' + bad)
  }
})

test('suWrap 用单引号包整串且转义内部单引号', () => {
  const wrapped = suWrap('mkdir -p ' + sq('/sdcard/a'))
  assert.equal(wrapped[0], 'su')
  assert.equal(wrapped[1], '-c')
  assert.ok(wrapped[2].startsWith("'") && wrapped[2].endsWith("'"))
  assert.ok(!wrapped[2].startsWith('"'))
  assert.ok(wrapped[2].includes("'\\''"))
})

test('注入串无法进入设备端命令', () => {
  assert.throws(() => safeTokens('; reboot'), /非法字符/)
  assert.throws(() => safeTokens('-p $(id)'), /非法字符/)
})
