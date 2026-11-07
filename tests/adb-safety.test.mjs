import test from 'node:test'
import assert from 'node:assert/strict'
import { assertIdent, shellLiteral, safeServiceTokens, assertNum } from '../main/adb-safety.js'

test('合法 Android 标识符通过', () => {
  assert.equal(assertIdent('com.foo.bar', 'pkg'), 'com.foo.bar')
  assert.equal(assertIdent('com.foo/.MainActivity', 'component'), 'com.foo/.MainActivity')
  assert.equal(assertIdent('android.permission.CAMERA', 'perm'), 'android.permission.CAMERA')
  assert.equal(assertIdent('KEYCODE_APP_SWITCH', 'key'), 'KEYCODE_APP_SWITCH')
  assert.equal(assertIdent('sideload-auto-reboot', 'mode'), 'sideload-auto-reboot')
})

test('shell 元字符一律拒绝', () => {
  for (const bad of [
    '; reboot', '$(id)', '`id`', 'a|b', 'a&b', 'a>b', 'a<b',
    "a'b", 'a"b', 'a\\b', 'a b', 'a#b', 'a*b', '', null
  ]) {
    assert.throws(() => assertIdent(bad, 'pkg'), /非法字符/, '应拒绝: ' + bad)
  }
})

test('自由文本包成单引号字面量且转义内部单引号', () => {
  assert.equal(shellLiteral('hello'), "'hello'")
  assert.equal(shellLiteral("a'b"), "'a'\\''b'")
  assert.equal(shellLiteral('a;$(id)'), "'a;$(id)'")
})

test('dumpsys 多词查询逐 token 校验', () => {
  assert.deepEqual(safeServiceTokens('activity top'), ['activity', 'top'])
  assert.deepEqual(safeServiceTokens('window'), ['window'])
  assert.throws(() => safeServiceTokens('window | grep x'), /非法字符/)
})

test('数值只接受整数', () => {
  assert.equal(assertNum(400, 'x'), '400')
  assert.equal(assertNum('-1', 'seed'), '-1')
  for (const bad of ['400;reboot', '1.5', 'abc', '', null]) {
    assert.throws(() => assertNum(bad, 'x'), /必须是整数/, '应拒绝: ' + bad)
  }
})
