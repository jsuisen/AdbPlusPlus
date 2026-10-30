// 共享状态：快捷操作（快捷命令 / 模拟按键 / 输入文本·点击·滑动 按钮组与各管理弹窗）
import { ref, reactive, computed } from 'vue'

// ---------- 快捷命令（quickbar） ----------
export const quickCommands = ref([])

export const newCmdName = ref('')

export const newCmdArgs = ref('')

export const newCmdGroup = ref('')

export const newCmdIgnore = ref(false)

export const cmdOutput = ref('')

export const cmdGroup = ref('全部')

export const managing = ref(false)

export const cmdGroups = computed(() => {
  const s = new Set()
  quickCommands.value.forEach((c) => s.add(c.group || '默认'))
  return [...s]
})

export const displayCmds = computed(() => {
  if (cmdGroup.value === '全部') return quickCommands.value
  return quickCommands.value.filter((c) => (c.group || '默认') === cmdGroup.value)
})

export const colorEditIndex = ref(null)

export const COLOR_PRESETS = ['#4a90d9', '#27ae60', '#e67e22', '#e74c3c', '#8e44ad', '#16a085', '#f1c40f', '#2c3e50']

export const cmdModalOpen = ref(false)

export const cmdModal = reactive({ cmd: '', body: '', full: '' })

// ---------- 模拟按键 ----------
export const PRESET_KEYS = [
  { name: '返回', key: 'KEYCODE_BACK', group: '预设' },
  { name: '主页', key: 'KEYCODE_HOME', group: '预设' },
  { name: '菜单', key: 'KEYCODE_MENU', group: '预设' },
  { name: '电源', key: 'KEYCODE_POWER', group: '预设' },
  { name: '音量+', key: 'KEYCODE_VOLUME_UP', group: '预设' },
  { name: '音量-', key: 'KEYCODE_VOLUME_DOWN', group: '预设' },
  { name: '静音', key: 'KEYCODE_VOLUME_MUTE', group: '预设' },
  { name: '亮度+', key: 'KEYCODE_BRIGHTNESS_UP', group: '预设' },
  { name: '亮度-', key: 'KEYCODE_BRIGHTNESS_DOWN', group: '预设' },
  { name: '播放/暂停', key: 'KEYCODE_MEDIA_PLAY_PAUSE', group: '预设' },
  { name: '下一首', key: 'KEYCODE_MEDIA_NEXT', group: '预设' },
  { name: '上一首', key: 'KEYCODE_MEDIA_PREVIOUS', group: '预设' }
]

export const keyButtons = ref([])

export const keyModalOpen = ref(false)

export const keyManaging = ref(false)

export const keyGroup = ref('全部')

export const newKeyName = ref('')

export const newKeyValue = ref('')

export const newKeyGroup = ref('')

export const keyColorEditIndex = ref(null)

export const keyGroups = computed(() => {
  const s = new Set(['预设'])
  keyButtons.value.forEach((k) => s.add(k.group || '默认'))
  return [...s]
})

export const displayKeys = computed(() => {
  const all = [...PRESET_KEYS, ...keyButtons.value]
  return keyGroup.value === '全部' ? all : all.filter((k) => (k.group || '预设') === keyGroup.value)
})

export const keyRefOpen = ref(false)

export const keyRefSearch = ref('')

export const KEYCODE_TABLE = [
  { value: 0, name: 'KEYCODE_UNKNOWN', desc: '未知按键' },
  { value: 1, name: 'KEYCODE_SOFT_LEFT', desc: '软左键' },
  { value: 2, name: 'KEYCODE_SOFT_RIGHT', desc: '软右键' },
  { value: 3, name: 'KEYCODE_HOME', desc: '主页' },
  { value: 4, name: 'KEYCODE_BACK', desc: '返回' },
  { value: 5, name: 'KEYCODE_CALL', desc: '拨号' },
  { value: 6, name: 'KEYCODE_ENDCALL', desc: '挂断' },
  { value: 7, name: 'KEYCODE_0', desc: '数字 0' },
  { value: 8, name: 'KEYCODE_1', desc: '数字 1' },
  { value: 9, name: 'KEYCODE_2', desc: '数字 2' },
  { value: 10, name: 'KEYCODE_3', desc: '数字 3' },
  { value: 11, name: 'KEYCODE_4', desc: '数字 4' },
  { value: 12, name: 'KEYCODE_5', desc: '数字 5' },
  { value: 13, name: 'KEYCODE_6', desc: '数字 6' },
  { value: 14, name: 'KEYCODE_7', desc: '数字 7' },
  { value: 15, name: 'KEYCODE_8', desc: '数字 8' },
  { value: 16, name: 'KEYCODE_9', desc: '数字 9' },
  { value: 17, name: 'KEYCODE_STAR', desc: '星号 *' },
  { value: 18, name: 'KEYCODE_POUND', desc: '井号 #' },
  { value: 19, name: 'KEYCODE_DPAD_UP', desc: '方向键 上' },
  { value: 20, name: 'KEYCODE_DPAD_DOWN', desc: '方向键 下' },
  { value: 21, name: 'KEYCODE_DPAD_LEFT', desc: '方向键 左' },
  { value: 22, name: 'KEYCODE_DPAD_RIGHT', desc: '方向键 右' },
  { value: 23, name: 'KEYCODE_DPAD_CENTER', desc: '方向键 中（确认）' },
  { value: 24, name: 'KEYCODE_VOLUME_UP', desc: '音量 +' },
  { value: 25, name: 'KEYCODE_VOLUME_DOWN', desc: '音量 -' },
  { value: 26, name: 'KEYCODE_POWER', desc: '电源' },
  { value: 27, name: 'KEYCODE_CAMERA', desc: '相机快门' },
  { value: 28, name: 'KEYCODE_CLEAR', desc: '清除' },
  { value: 29, name: 'KEYCODE_A', desc: '字母 A' },
  { value: 30, name: 'KEYCODE_B', desc: '字母 B' },
  { value: 31, name: 'KEYCODE_C', desc: '字母 C' },
  { value: 32, name: 'KEYCODE_D', desc: '字母 D' },
  { value: 33, name: 'KEYCODE_E', desc: '字母 E' },
  { value: 34, name: 'KEYCODE_F', desc: '字母 F' },
  { value: 35, name: 'KEYCODE_G', desc: '字母 G' },
  { value: 36, name: 'KEYCODE_H', desc: '字母 H' },
  { value: 37, name: 'KEYCODE_I', desc: '字母 I' },
  { value: 38, name: 'KEYCODE_J', desc: '字母 J' },
  { value: 39, name: 'KEYCODE_K', desc: '字母 K' },
  { value: 40, name: 'KEYCODE_L', desc: '字母 L' },
  { value: 41, name: 'KEYCODE_M', desc: '字母 M' },
  { value: 42, name: 'KEYCODE_N', desc: '字母 N' },
  { value: 43, name: 'KEYCODE_O', desc: '字母 O' },
  { value: 44, name: 'KEYCODE_P', desc: '字母 P' },
  { value: 45, name: 'KEYCODE_Q', desc: '字母 Q' },
  { value: 46, name: 'KEYCODE_R', desc: '字母 R' },
  { value: 47, name: 'KEYCODE_S', desc: '字母 S' },
  { value: 48, name: 'KEYCODE_T', desc: '字母 T' },
  { value: 49, name: 'KEYCODE_U', desc: '字母 U' },
  { value: 50, name: 'KEYCODE_V', desc: '字母 V' },
  { value: 51, name: 'KEYCODE_W', desc: '字母 W' },
  { value: 52, name: 'KEYCODE_X', desc: '字母 X' },
  { value: 53, name: 'KEYCODE_Y', desc: '字母 Y' },
  { value: 54, name: 'KEYCODE_Z', desc: '字母 Z' },
  { value: 55, name: 'KEYCODE_COMMA', desc: '逗号' },
  { value: 56, name: 'KEYCODE_PERIOD', desc: '句号' },
  { value: 57, name: 'KEYCODE_ALT_LEFT', desc: '左 Alt' },
  { value: 58, name: 'KEYCODE_ALT_RIGHT', desc: '右 Alt' },
  { value: 59, name: 'KEYCODE_SHIFT_LEFT', desc: '左 Shift' },
  { value: 60, name: 'KEYCODE_SHIFT_RIGHT', desc: '右 Shift' },
  { value: 61, name: 'KEYCODE_TAB', desc: 'Tab' },
  { value: 62, name: 'KEYCODE_SPACE', desc: '空格' },
  { value: 63, name: 'KEYCODE_SYM', desc: '符号键' },
  { value: 64, name: 'KEYCODE_EXPLORER', desc: '浏览器' },
  { value: 65, name: 'KEYCODE_ENVELOPE', desc: '邮件' },
  { value: 66, name: 'KEYCODE_ENTER', desc: '回车' },
  { value: 67, name: 'KEYCODE_DEL', desc: '删除（退格）' },
  { value: 68, name: 'KEYCODE_GRAVE', desc: '重音符号 ` / ~' },
  { value: 69, name: 'KEYCODE_MINUS', desc: '减号 -' },
  { value: 70, name: 'KEYCODE_EQUALS', desc: '等号 =' },
  { value: 71, name: 'KEYCODE_LEFT_BRACKET', desc: '左方括号 [' },
  { value: 72, name: 'KEYCODE_RIGHT_BRACKET', desc: '右方括号 ]' },
  { value: 73, name: 'KEYCODE_BACKSLASH', desc: '反斜杠 \\' },
  { value: 74, name: 'KEYCODE_SEMICOLON', desc: '分号 ;' },
  { value: 75, name: 'KEYCODE_APOSTROPHE', desc: "单引号 '" },
  { value: 76, name: 'KEYCODE_SLASH', desc: '斜杠 /' },
  { value: 77, name: 'KEYCODE_AT', desc: 'At 符号 @' },
  { value: 78, name: 'KEYCODE_NUM', desc: 'Num 键 / 数字修饰键' },
  { value: 79, name: 'KEYCODE_HEADSETHOOK', desc: '耳机钩键 / 媒体控制键' },
  { value: 80, name: 'KEYCODE_FOCUS', desc: '相机对焦' },
  { value: 81, name: 'KEYCODE_PLUS', desc: '加号 +' },
  { value: 82, name: 'KEYCODE_MENU', desc: '菜单' },
  { value: 83, name: 'KEYCODE_NOTIFICATION', desc: '通知' },
  { value: 84, name: 'KEYCODE_SEARCH', desc: '搜索' },
  { value: 85, name: 'KEYCODE_MEDIA_PLAY_PAUSE', desc: '媒体 播放/暂停' },
  { value: 86, name: 'KEYCODE_MEDIA_STOP', desc: '媒体 停止' },
  { value: 87, name: 'KEYCODE_MEDIA_NEXT', desc: '媒体 下一首' },
  { value: 88, name: 'KEYCODE_MEDIA_PREVIOUS', desc: '媒体 上一首' },
  { value: 89, name: 'KEYCODE_MEDIA_REWIND', desc: '媒体 快退' },
  { value: 90, name: 'KEYCODE_MEDIA_FAST_FORWARD', desc: '媒体 快进' },
  { value: 91, name: 'KEYCODE_MUTE', desc: '静音' },
  { value: 92, name: 'KEYCODE_PAGE_UP', desc: '上翻页' },
  { value: 93, name: 'KEYCODE_PAGE_DOWN', desc: '下翻页' },
  { value: 94, name: 'KEYCODE_PICTSYMBOLS', desc: '图形符号' },
  { value: 95, name: 'KEYCODE_SWITCH_CHARSET', desc: '切换字符集' },
  { value: 96, name: 'KEYCODE_BUTTON_A', desc: '手柄 A 键' },
  { value: 97, name: 'KEYCODE_BUTTON_B', desc: '手柄 B 键' },
  { value: 98, name: 'KEYCODE_BUTTON_C', desc: '手柄 C 键' },
  { value: 99, name: 'KEYCODE_BUTTON_X', desc: '手柄 X 键' },
  { value: 100, name: 'KEYCODE_BUTTON_Y', desc: '手柄 Y 键' },
  { value: 101, name: 'KEYCODE_BUTTON_Z', desc: '手柄 Z 键' },
  { value: 102, name: 'KEYCODE_BUTTON_L1', desc: '手柄 L1' },
  { value: 103, name: 'KEYCODE_BUTTON_R1', desc: '手柄 R1' },
  { value: 104, name: 'KEYCODE_BUTTON_L2', desc: '手柄 L2' },
  { value: 105, name: 'KEYCODE_BUTTON_R2', desc: '手柄 R2' },
  { value: 106, name: 'KEYCODE_BUTTON_THUMBL', desc: '左摇杆按下' },
  { value: 107, name: 'KEYCODE_BUTTON_THUMBR', desc: '右摇杆按下' },
  { value: 108, name: 'KEYCODE_BUTTON_START', desc: '手柄 Start' },
  { value: 109, name: 'KEYCODE_BUTTON_SELECT', desc: '手柄 Select' },
  { value: 110, name: 'KEYCODE_BUTTON_MODE', desc: '手柄 Mode' },
  { value: 111, name: 'KEYCODE_ESCAPE', desc: 'Esc' },
  { value: 112, name: 'KEYCODE_FORWARD_DEL', desc: '向前删除' },
  { value: 113, name: 'KEYCODE_CTRL_LEFT', desc: '左 Ctrl' },
  { value: 114, name: 'KEYCODE_CTRL_RIGHT', desc: '右 Ctrl' },
  { value: 115, name: 'KEYCODE_CAPS_LOCK', desc: '大写锁定' },
  { value: 116, name: 'KEYCODE_SCROLL_LOCK', desc: '滚动锁定' },
  { value: 117, name: 'KEYCODE_META_LEFT', desc: '左 Meta' },
  { value: 118, name: 'KEYCODE_META_RIGHT', desc: '右 Meta' },
  { value: 119, name: 'KEYCODE_FUNCTION', desc: '功能键' },
  { value: 120, name: 'KEYCODE_SYSRQ', desc: '打印屏幕' },
  { value: 121, name: 'KEYCODE_BREAK', desc: '中断' },
  { value: 122, name: 'KEYCODE_MOVE_HOME', desc: '光标移到行首' },
  { value: 123, name: 'KEYCODE_MOVE_END', desc: '光标移到行尾' },
  { value: 124, name: 'KEYCODE_INSERT', desc: '插入' },
  { value: 125, name: 'KEYCODE_FORWARD', desc: '前进' },
  { value: 126, name: 'KEYCODE_MEDIA_PLAY', desc: '媒体 播放' },
  { value: 127, name: 'KEYCODE_MEDIA_PAUSE', desc: '媒体 暂停' },
  { value: 128, name: 'KEYCODE_MEDIA_CLOSE', desc: '媒体 关闭' },
  { value: 129, name: 'KEYCODE_MEDIA_EJECT', desc: '媒体 弹出' },
  { value: 130, name: 'KEYCODE_MEDIA_RECORD', desc: '媒体 录制' },
  { value: 131, name: 'KEYCODE_F1', desc: '功能键 F1' },
  { value: 132, name: 'KEYCODE_F2', desc: '功能键 F2' },
  { value: 133, name: 'KEYCODE_F3', desc: '功能键 F3' },
  { value: 134, name: 'KEYCODE_F4', desc: '功能键 F4' },
  { value: 135, name: 'KEYCODE_F5', desc: '功能键 F5' },
  { value: 136, name: 'KEYCODE_F6', desc: '功能键 F6' },
  { value: 137, name: 'KEYCODE_F7', desc: '功能键 F7' },
  { value: 138, name: 'KEYCODE_F8', desc: '功能键 F8' },
  { value: 139, name: 'KEYCODE_F9', desc: '功能键 F9' },
  { value: 140, name: 'KEYCODE_F10', desc: '功能键 F10' },
  { value: 141, name: 'KEYCODE_F11', desc: '功能键 F11' },
  { value: 142, name: 'KEYCODE_F12', desc: '功能键 F12' },
  { value: 143, name: 'KEYCODE_NUM_LOCK', desc: '小键盘锁定' },
  { value: 144, name: 'KEYCODE_NUMPAD_0', desc: '小键盘 0' },
  { value: 145, name: 'KEYCODE_NUMPAD_1', desc: '小键盘 1' },
  { value: 146, name: 'KEYCODE_NUMPAD_2', desc: '小键盘 2' },
  { value: 147, name: 'KEYCODE_NUMPAD_3', desc: '小键盘 3' },
  { value: 148, name: 'KEYCODE_NUMPAD_4', desc: '小键盘 4' },
  { value: 149, name: 'KEYCODE_NUMPAD_5', desc: '小键盘 5' },
  { value: 150, name: 'KEYCODE_NUMPAD_6', desc: '小键盘 6' },
  { value: 151, name: 'KEYCODE_NUMPAD_7', desc: '小键盘 7' },
  { value: 152, name: 'KEYCODE_NUMPAD_8', desc: '小键盘 8' },
  { value: 153, name: 'KEYCODE_NUMPAD_9', desc: '小键盘 9' },
  { value: 154, name: 'KEYCODE_NUMPAD_DIVIDE', desc: '小键盘 除' },
  { value: 155, name: 'KEYCODE_NUMPAD_MULTIPLY', desc: '小键盘 乘' },
  { value: 156, name: 'KEYCODE_NUMPAD_SUBTRACT', desc: '小键盘 减' },
  { value: 157, name: 'KEYCODE_NUMPAD_ADD', desc: '小键盘 加' },
  { value: 158, name: 'KEYCODE_NUMPAD_DOT', desc: '小键盘 小数点' },
  { value: 159, name: 'KEYCODE_NUMPAD_COMMA', desc: '小键盘 逗号' },
  { value: 160, name: 'KEYCODE_NUMPAD_ENTER', desc: '小键盘 回车' },
  { value: 161, name: 'KEYCODE_NUMPAD_EQUALS', desc: '小键盘 等于' },
  { value: 162, name: 'KEYCODE_NUMPAD_LEFT_PAREN', desc: '小键盘 左括号' },
  { value: 163, name: 'KEYCODE_NUMPAD_RIGHT_PAREN', desc: '小键盘 右括号' },
  { value: 164, name: 'KEYCODE_VOLUME_MUTE', desc: '音量静音' },
  { value: 165, name: 'KEYCODE_INFO', desc: '信息' },
  { value: 166, name: 'KEYCODE_CHANNEL_UP', desc: '频道 +' },
  { value: 167, name: 'KEYCODE_CHANNEL_DOWN', desc: '频道 -' },
  { value: 168, name: 'KEYCODE_ZOOM_IN', desc: '放大' },
  { value: 169, name: 'KEYCODE_ZOOM_OUT', desc: '缩小' },
  { value: 170, name: 'KEYCODE_TV', desc: '电视' },
  { value: 171, name: 'KEYCODE_WINDOW', desc: '窗口' },
  { value: 172, name: 'KEYCODE_GUIDE', desc: '指南' },
  { value: 173, name: 'KEYCODE_DVR', desc: '录像机' },
  { value: 174, name: 'KEYCODE_BOOKMARK', desc: '书签' },
  { value: 175, name: 'KEYCODE_CAPTIONS', desc: '字幕' },
  { value: 176, name: 'KEYCODE_SETTINGS', desc: '设置' },
  { value: 177, name: 'KEYCODE_TV_POWER', desc: '电视电源' },
  { value: 178, name: 'KEYCODE_TV_INPUT', desc: '电视输入源' },
  { value: 179, name: 'KEYCODE_STB_POWER', desc: '机顶盒电源' },
  { value: 180, name: 'KEYCODE_STB_INPUT', desc: '机顶盒输入源' },
  { value: 181, name: 'KEYCODE_AVR_POWER', desc: '功放电源' },
  { value: 182, name: 'KEYCODE_AVR_INPUT', desc: '功放输入源' },
  { value: 183, name: 'KEYCODE_PROG_RED', desc: '彩色键 红' },
  { value: 184, name: 'KEYCODE_PROG_GREEN', desc: '彩色键 绿' },
  { value: 185, name: 'KEYCODE_PROG_YELLOW', desc: '彩色键 黄' },
  { value: 186, name: 'KEYCODE_PROG_BLUE', desc: '彩色键 蓝' },
  { value: 187, name: 'KEYCODE_APP_SWITCH', desc: '多任务/应用切换' },
  { value: 188, name: 'KEYCODE_BUTTON_1', desc: '手柄扩展键 1' },
  { value: 189, name: 'KEYCODE_BUTTON_2', desc: '手柄扩展键 2' },
  { value: 190, name: 'KEYCODE_BUTTON_3', desc: '手柄扩展键 3' },
  { value: 191, name: 'KEYCODE_BUTTON_4', desc: '手柄扩展键 4' },
  { value: 192, name: 'KEYCODE_BUTTON_5', desc: '手柄扩展键 5' },
  { value: 193, name: 'KEYCODE_BUTTON_6', desc: '手柄扩展键 6' },
  { value: 194, name: 'KEYCODE_BUTTON_7', desc: '手柄扩展键 7' },
  { value: 195, name: 'KEYCODE_BUTTON_8', desc: '手柄扩展键 8' },
  { value: 196, name: 'KEYCODE_BUTTON_9', desc: '手柄扩展键 9' },
  { value: 197, name: 'KEYCODE_BUTTON_10', desc: '手柄扩展键 10' },
  { value: 198, name: 'KEYCODE_BUTTON_11', desc: '手柄扩展键 11' },
  { value: 199, name: 'KEYCODE_BUTTON_12', desc: '手柄扩展键 12' },
  { value: 200, name: 'KEYCODE_BUTTON_13', desc: '手柄扩展键 13' },
  { value: 201, name: 'KEYCODE_BUTTON_14', desc: '手柄扩展键 14' },
  { value: 202, name: 'KEYCODE_BUTTON_15', desc: '手柄扩展键 15' },
  { value: 203, name: 'KEYCODE_BUTTON_16', desc: '手柄扩展键 16' },
  { value: 204, name: 'KEYCODE_LANGUAGE_SWITCH', desc: '切换输入语言' },
  { value: 205, name: 'KEYCODE_MANNER_MODE', desc: '情景模式' },
  { value: 206, name: 'KEYCODE_3D_MODE', desc: '3D 模式' },
  { value: 207, name: 'KEYCODE_CONTACTS', desc: '联系人' },
  { value: 208, name: 'KEYCODE_CALENDAR', desc: '日历' },
  { value: 209, name: 'KEYCODE_MUSIC', desc: '音乐' },
  { value: 210, name: 'KEYCODE_CALCULATOR', desc: '计算器' },
  { value: 211, name: 'KEYCODE_ZENKAKU_HANKAKU', desc: '全角/半角' },
  { value: 212, name: 'KEYCODE_EISU', desc: '英数' },
  { value: 213, name: 'KEYCODE_MUHENKAN', desc: '无变换' },
  { value: 214, name: 'KEYCODE_HENKAN', desc: '变换' },
  { value: 215, name: 'KEYCODE_KATAKANA_HIRAGANA', desc: '片假名/平假名' },
  { value: 216, name: 'KEYCODE_YEN', desc: '日元符号' },
  { value: 217, name: 'KEYCODE_RO', desc: 'ロ 键' },
  { value: 218, name: 'KEYCODE_KANA', desc: '假名' },
  { value: 219, name: 'KEYCODE_ASSIST', desc: '助手' },
  { value: 220, name: 'KEYCODE_BRIGHTNESS_DOWN', desc: '亮度 -' },
  { value: 221, name: 'KEYCODE_BRIGHTNESS_UP', desc: '亮度 +' },
  { value: 222, name: 'KEYCODE_MEDIA_AUDIO_TRACK', desc: '音轨切换' },
  { value: 223, name: 'KEYCODE_SLEEP', desc: '休眠' },
  { value: 224, name: 'KEYCODE_WAKEUP', desc: '唤醒' },
  { value: 225, name: 'KEYCODE_PAIRING', desc: '配对' },
  { value: 226, name: 'KEYCODE_MEDIA_TOP_MENU', desc: '媒体顶层菜单' },
  { value: 227, name: 'KEYCODE_11', desc: '数字 11' },
  { value: 228, name: 'KEYCODE_12', desc: '数字 12' },
  { value: 229, name: 'KEYCODE_LAST_CHANNEL', desc: '上一个频道' },
  { value: 230, name: 'KEYCODE_TV_DATA_SERVICE', desc: '电视数据服务' },
  { value: 231, name: 'KEYCODE_VOICE_ASSIST', desc: '语音助手' },
  { value: 232, name: 'KEYCODE_TV_RADIO_SERVICE', desc: '电视广播' },
  { value: 233, name: 'KEYCODE_TV_TELETEXT', desc: '电视图文' },
  { value: 234, name: 'KEYCODE_TV_NUMBER_ENTRY', desc: '电视数字输入' },
  { value: 235, name: 'KEYCODE_TV_TERRESTRIAL_ANALOG', desc: '地面模拟电视' },
  { value: 236, name: 'KEYCODE_TV_TERRESTRIAL_DIGITAL', desc: '地面数字电视' },
  { value: 237, name: 'KEYCODE_TV_SATELLITE', desc: '卫星电视' },
  { value: 238, name: 'KEYCODE_TV_SATELLITE_BS', desc: 'BS 卫星电视' },
  { value: 239, name: 'KEYCODE_TV_SATELLITE_CS', desc: 'CS 卫星电视' },
  { value: 240, name: 'KEYCODE_TV_SATELLITE_SERVICE', desc: '卫星电视服务' },
  { value: 241, name: 'KEYCODE_TV_NETWORK', desc: '电视网络' },
  { value: 242, name: 'KEYCODE_TV_ANTENNA_CABLE', desc: '天线/有线' },
  { value: 243, name: 'KEYCODE_TV_INPUT_HDMI_1', desc: 'HDMI 输入 1' },
  { value: 244, name: 'KEYCODE_TV_INPUT_HDMI_2', desc: 'HDMI 输入 2' },
  { value: 245, name: 'KEYCODE_TV_INPUT_HDMI_3', desc: 'HDMI 输入 3' },
  { value: 246, name: 'KEYCODE_TV_INPUT_HDMI_4', desc: 'HDMI 输入 4' },
  { value: 247, name: 'KEYCODE_TV_INPUT_COMPOSITE_1', desc: '复合输入 1' },
  { value: 248, name: 'KEYCODE_TV_INPUT_COMPOSITE_2', desc: '复合输入 2' },
  { value: 249, name: 'KEYCODE_TV_INPUT_COMPONENT_1', desc: '分量输入 1' },
  { value: 250, name: 'KEYCODE_TV_INPUT_COMPONENT_2', desc: '分量输入 2' },
  { value: 251, name: 'KEYCODE_TV_INPUT_VGA_1', desc: 'VGA 输入 1' },
  { value: 252, name: 'KEYCODE_TV_AUDIO_DESCRIPTION', desc: '音频描述' },
  { value: 253, name: 'KEYCODE_TV_AUDIO_DESCRIPTION_MIX_UP', desc: '音频描述混音 +' },
  { value: 254, name: 'KEYCODE_TV_AUDIO_DESCRIPTION_MIX_DOWN', desc: '音频描述混音 -' },
  { value: 255, name: 'KEYCODE_TV_ZOOM_MODE', desc: '电视缩放模式' },
  { value: 256, name: 'KEYCODE_TV_CONTENTS_MENU', desc: '电视内容菜单' },
  { value: 257, name: 'KEYCODE_TV_MEDIA_CONTEXT_MENU', desc: '电视媒体菜单' },
  { value: 258, name: 'KEYCODE_TV_TIMER_PROGRAMMING', desc: '电视定时' },
  { value: 259, name: 'KEYCODE_HELP', desc: '帮助' },
  { value: 260, name: 'KEYCODE_NAVIGATE_PREVIOUS', desc: '导航 上一' },
  { value: 261, name: 'KEYCODE_NAVIGATE_NEXT', desc: '导航 下一' },
  { value: 262, name: 'KEYCODE_NAVIGATE_IN', desc: '导航 进入' },
  { value: 263, name: 'KEYCODE_NAVIGATE_OUT', desc: '导航 退出' },
  { value: 264, name: 'KEYCODE_STEM_PRIMARY', desc: '主控 Stem 键' },
  { value: 265, name: 'KEYCODE_STEM_1', desc: 'Stem 键 1' },
  { value: 266, name: 'KEYCODE_STEM_2', desc: 'Stem 键 2' },
  { value: 267, name: 'KEYCODE_STEM_3', desc: 'Stem 键 3' },
  { value: 268, name: 'KEYCODE_DPAD_UP_LEFT', desc: '方向 上左' },
  { value: 269, name: 'KEYCODE_DPAD_DOWN_LEFT', desc: '方向 下左' },
  { value: 270, name: 'KEYCODE_DPAD_UP_RIGHT', desc: '方向 上右' },
  { value: 271, name: 'KEYCODE_DPAD_DOWN_RIGHT', desc: '方向 下右' },
  { value: 272, name: 'KEYCODE_MEDIA_SKIP_FORWARD', desc: '媒体 快进跳过' },
  { value: 273, name: 'KEYCODE_MEDIA_SKIP_BACKWARD', desc: '媒体 快退跳过' },
  { value: 274, name: 'KEYCODE_MEDIA_STEP_FORWARD', desc: '媒体 逐帧进' },
  { value: 275, name: 'KEYCODE_MEDIA_STEP_BACKWARD', desc: '媒体 逐帧退' },
  { value: 276, name: 'KEYCODE_SOFT_SLEEP', desc: '软休眠' },
  { value: 277, name: 'KEYCODE_CUT', desc: '剪切' },
  { value: 278, name: 'KEYCODE_COPY', desc: '复制' },
  { value: 279, name: 'KEYCODE_PASTE', desc: '粘贴' },
  { value: 280, name: 'KEYCODE_SYSTEM_NAVIGATION_UP', desc: '系统导航 上' },
  { value: 281, name: 'KEYCODE_SYSTEM_NAVIGATION_DOWN', desc: '系统导航 下' },
  { value: 282, name: 'KEYCODE_SYSTEM_NAVIGATION_LEFT', desc: '系统导航 左' },
  { value: 283, name: 'KEYCODE_SYSTEM_NAVIGATION_RIGHT', desc: '系统导航 右' },
  { value: 284, name: 'KEYCODE_ALL_APPS', desc: '所有应用' },
  { value: 285, name: 'KEYCODE_REFRESH', desc: '刷新' },
  { value: 286, name: 'KEYCODE_THUMBS_UP', desc: '赞' },
  { value: 287, name: 'KEYCODE_THUMBS_DOWN', desc: '踩' },
  { value: 288, name: 'KEYCODE_PROFILE_SWITCH', desc: '切换个人资料' }
]

export const filteredKeycodes = computed(() => {
  const q = keyRefSearch.value.trim().toLowerCase()
  if (!q) return KEYCODE_TABLE
  return KEYCODE_TABLE.filter(r =>
    r.name.toLowerCase().includes(q) ||
    String(r.value).includes(q) ||
    (r.desc || '').toLowerCase().includes(q)
  )
})

// ---------- 输入文本 / 点击 / 滑动 ----------
export const INPUT_TYPES = {
  text:  { title: '输入文本', channel: 'adb:inputText',  build: (v) => ({ text: v.text }) },
  tap:   { title: '模拟点击', channel: 'adb:inputTap',   build: (v) => ({ x: Number(v.x), y: Number(v.y) }) },
  swipe: { title: '模拟滑动', channel: 'adb:inputSwipe', build: (v) => ({ x1: Number(v.x1), y1: Number(v.y1), x2: Number(v.x2), y2: Number(v.y2), duration: (v.duration == null || v.duration === '') ? null : Number(v.duration) }) }
}

export const INPUT_VALUE_FIELDS = {
  text:  [ { prop: 'text', label: '文本值', type: 'text' } ],
  tap:   [ { prop: 'x', label: 'X', type: 'num' }, { prop: 'y', label: 'Y', type: 'num' } ],
  swipe: [ { prop: 'x1', label: 'X1', type: 'num' }, { prop: 'y1', label: 'Y1', type: 'num' }, { prop: 'x2', label: 'X2', type: 'num' }, { prop: 'y2', label: 'Y2', type: 'num' }, { prop: 'duration', label: '时长ms', type: 'num', optional: true } ]
}

export const textButtons = ref([])

export const tapButtons = ref([])

export const swipeButtons = ref([])

export const inputModalOpen = ref(false)

export const inputModalType = ref('text')

export const inputManaging = ref(false)

export const inputGroup = ref('全部')

export const inputColorEditIndex = ref(null)

export const newInputName = ref('')

export const newInputGroup = ref('')

export const newInputVal = reactive({ text: '', x: '', y: '', x1: '', y1: '', x2: '', y2: '', duration: '' })

// 按输入类型取对应按钮组（state 层选择器，供 inputButtons computed 与操作层共用）
export function inputButtonsOf(t) { return t === 'text' ? textButtons.value : t === 'tap' ? tapButtons.value : swipeButtons.value }

export const inputButtons = computed(() => inputButtonsOf(inputModalType.value))

export const inputGroups = computed(() => {
  const s = new Set(['预设'])
  inputButtons.value.forEach((k) => s.add(k.group || '默认'))
  return [...s]
})

export const displayInputs = computed(() => {
  const all = inputButtons.value
  return inputGroup.value === '全部' ? all : all.filter((k) => (k.group || '预设') === inputGroup.value)
})
