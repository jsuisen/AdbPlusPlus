// 共享状态：快捷操作（快捷命令 / 模拟按键 / 输入文本·点击·滑动 按钮组与各管理弹窗）
import { ref, reactive, computed } from 'vue'
import { t, tKeycode } from '@/i18n'

// 分组哨兵：这些值参与逻辑比较，禁止改成中文文案（否则切换语言后筛选静默失效）。
export const ALL_GROUPS = '__all__'
export const PRESET_GROUP = '__preset__'
export const NO_GROUP = ''   // 用户未填分组时存空串，显示时回退 t('common.defaultGroup')

// ---------- 快捷命令（quickbar） ----------
export const quickCommands = ref([])

export const newCmdName = ref('')

export const newCmdArgs = ref('')

export const newCmdGroup = ref('')

export const newCmdIgnore = ref(false)

export const cmdOutput = ref('')

export const cmdGroup = ref(ALL_GROUPS)

export const managing = ref(false)

export const cmdGroups = computed(() => {
  const s = new Set()
  quickCommands.value.forEach((c) => s.add(c.group || NO_GROUP))
  return [...s]
})

export const displayCmds = computed(() => {
  if (cmdGroup.value === ALL_GROUPS) return quickCommands.value
  return quickCommands.value.filter((c) => (c.group || NO_GROUP) === cmdGroup.value)
})

export const colorEditIndex = ref(null)

export const COLOR_PRESETS = ['#4a90d9', '#27ae60', '#e67e22', '#e74c3c', '#8e44ad', '#16a085', '#f1c40f', '#2c3e50']

export const cmdModalOpen = ref(false)

export const cmdModal = reactive({ cmd: '', body: '', full: '' })

// ---------- 模拟按键 ----------
export const PRESET_KEYS = [
  { nameKey: 'key.back', key: 'KEYCODE_BACK', group: PRESET_GROUP },
  { nameKey: 'key.home', key: 'KEYCODE_HOME', group: PRESET_GROUP },
  { nameKey: 'key.menu', key: 'KEYCODE_MENU', group: PRESET_GROUP },
  { nameKey: 'key.power', key: 'KEYCODE_POWER', group: PRESET_GROUP },
  { nameKey: 'key.volumeUp', key: 'KEYCODE_VOLUME_UP', group: PRESET_GROUP },
  { nameKey: 'key.volumeDown', key: 'KEYCODE_VOLUME_DOWN', group: PRESET_GROUP },
  { nameKey: 'key.mute', key: 'KEYCODE_VOLUME_MUTE', group: PRESET_GROUP },
  { nameKey: 'key.brightnessUp', key: 'KEYCODE_BRIGHTNESS_UP', group: PRESET_GROUP },
  { nameKey: 'key.brightnessDown', key: 'KEYCODE_BRIGHTNESS_DOWN', group: PRESET_GROUP },
  { nameKey: 'key.playPause', key: 'KEYCODE_MEDIA_PLAY_PAUSE', group: PRESET_GROUP },
  { nameKey: 'key.next', key: 'KEYCODE_MEDIA_NEXT', group: PRESET_GROUP },
  { nameKey: 'key.prev', key: 'KEYCODE_MEDIA_PREVIOUS', group: PRESET_GROUP }
]

export const keyButtons = ref([])

export const keyModalOpen = ref(false)

export const keyManaging = ref(false)

export const keyGroup = ref(ALL_GROUPS)

export const newKeyName = ref('')

export const newKeyValue = ref('')

export const newKeyGroup = ref('')

export const keyColorEditIndex = ref(null)

export const keyGroups = computed(() => {
  const s = new Set([PRESET_GROUP])
  keyButtons.value.forEach((k) => s.add(k.group || NO_GROUP))
  return [...s]
})

export const displayKeys = computed(() => {
  const all = [...PRESET_KEYS, ...keyButtons.value]
  return keyGroup.value === ALL_GROUPS ? all : all.filter((k) => (k.group || PRESET_GROUP) === keyGroup.value)
})

export const keyRefOpen = ref(false)

export const keyRefSearch = ref('')

export const KEYCODE_TABLE = [
  { value: 0, name: 'KEYCODE_UNKNOWN' },
  { value: 1, name: 'KEYCODE_SOFT_LEFT' },
  { value: 2, name: 'KEYCODE_SOFT_RIGHT' },
  { value: 3, name: 'KEYCODE_HOME' },
  { value: 4, name: 'KEYCODE_BACK' },
  { value: 5, name: 'KEYCODE_CALL' },
  { value: 6, name: 'KEYCODE_ENDCALL' },
  { value: 7, name: 'KEYCODE_0' },
  { value: 8, name: 'KEYCODE_1' },
  { value: 9, name: 'KEYCODE_2' },
  { value: 10, name: 'KEYCODE_3' },
  { value: 11, name: 'KEYCODE_4' },
  { value: 12, name: 'KEYCODE_5' },
  { value: 13, name: 'KEYCODE_6' },
  { value: 14, name: 'KEYCODE_7' },
  { value: 15, name: 'KEYCODE_8' },
  { value: 16, name: 'KEYCODE_9' },
  { value: 17, name: 'KEYCODE_STAR' },
  { value: 18, name: 'KEYCODE_POUND' },
  { value: 19, name: 'KEYCODE_DPAD_UP' },
  { value: 20, name: 'KEYCODE_DPAD_DOWN' },
  { value: 21, name: 'KEYCODE_DPAD_LEFT' },
  { value: 22, name: 'KEYCODE_DPAD_RIGHT' },
  { value: 23, name: 'KEYCODE_DPAD_CENTER' },
  { value: 24, name: 'KEYCODE_VOLUME_UP' },
  { value: 25, name: 'KEYCODE_VOLUME_DOWN' },
  { value: 26, name: 'KEYCODE_POWER' },
  { value: 27, name: 'KEYCODE_CAMERA' },
  { value: 28, name: 'KEYCODE_CLEAR' },
  { value: 29, name: 'KEYCODE_A' },
  { value: 30, name: 'KEYCODE_B' },
  { value: 31, name: 'KEYCODE_C' },
  { value: 32, name: 'KEYCODE_D' },
  { value: 33, name: 'KEYCODE_E' },
  { value: 34, name: 'KEYCODE_F' },
  { value: 35, name: 'KEYCODE_G' },
  { value: 36, name: 'KEYCODE_H' },
  { value: 37, name: 'KEYCODE_I' },
  { value: 38, name: 'KEYCODE_J' },
  { value: 39, name: 'KEYCODE_K' },
  { value: 40, name: 'KEYCODE_L' },
  { value: 41, name: 'KEYCODE_M' },
  { value: 42, name: 'KEYCODE_N' },
  { value: 43, name: 'KEYCODE_O' },
  { value: 44, name: 'KEYCODE_P' },
  { value: 45, name: 'KEYCODE_Q' },
  { value: 46, name: 'KEYCODE_R' },
  { value: 47, name: 'KEYCODE_S' },
  { value: 48, name: 'KEYCODE_T' },
  { value: 49, name: 'KEYCODE_U' },
  { value: 50, name: 'KEYCODE_V' },
  { value: 51, name: 'KEYCODE_W' },
  { value: 52, name: 'KEYCODE_X' },
  { value: 53, name: 'KEYCODE_Y' },
  { value: 54, name: 'KEYCODE_Z' },
  { value: 55, name: 'KEYCODE_COMMA' },
  { value: 56, name: 'KEYCODE_PERIOD' },
  { value: 57, name: 'KEYCODE_ALT_LEFT' },
  { value: 58, name: 'KEYCODE_ALT_RIGHT' },
  { value: 59, name: 'KEYCODE_SHIFT_LEFT' },
  { value: 60, name: 'KEYCODE_SHIFT_RIGHT' },
  { value: 61, name: 'KEYCODE_TAB' },
  { value: 62, name: 'KEYCODE_SPACE' },
  { value: 63, name: 'KEYCODE_SYM' },
  { value: 64, name: 'KEYCODE_EXPLORER' },
  { value: 65, name: 'KEYCODE_ENVELOPE' },
  { value: 66, name: 'KEYCODE_ENTER' },
  { value: 67, name: 'KEYCODE_DEL' },
  { value: 68, name: 'KEYCODE_GRAVE' },
  { value: 69, name: 'KEYCODE_MINUS' },
  { value: 70, name: 'KEYCODE_EQUALS' },
  { value: 71, name: 'KEYCODE_LEFT_BRACKET' },
  { value: 72, name: 'KEYCODE_RIGHT_BRACKET' },
  { value: 73, name: 'KEYCODE_BACKSLASH' },
  { value: 74, name: 'KEYCODE_SEMICOLON' },
  { value: 75, name: 'KEYCODE_APOSTROPHE' },
  { value: 76, name: 'KEYCODE_SLASH' },
  { value: 77, name: 'KEYCODE_AT' },
  { value: 78, name: 'KEYCODE_NUM' },
  { value: 79, name: 'KEYCODE_HEADSETHOOK' },
  { value: 80, name: 'KEYCODE_FOCUS' },
  { value: 81, name: 'KEYCODE_PLUS' },
  { value: 82, name: 'KEYCODE_MENU' },
  { value: 83, name: 'KEYCODE_NOTIFICATION' },
  { value: 84, name: 'KEYCODE_SEARCH' },
  { value: 85, name: 'KEYCODE_MEDIA_PLAY_PAUSE' },
  { value: 86, name: 'KEYCODE_MEDIA_STOP' },
  { value: 87, name: 'KEYCODE_MEDIA_NEXT' },
  { value: 88, name: 'KEYCODE_MEDIA_PREVIOUS' },
  { value: 89, name: 'KEYCODE_MEDIA_REWIND' },
  { value: 90, name: 'KEYCODE_MEDIA_FAST_FORWARD' },
  { value: 91, name: 'KEYCODE_MUTE' },
  { value: 92, name: 'KEYCODE_PAGE_UP' },
  { value: 93, name: 'KEYCODE_PAGE_DOWN' },
  { value: 94, name: 'KEYCODE_PICTSYMBOLS' },
  { value: 95, name: 'KEYCODE_SWITCH_CHARSET' },
  { value: 96, name: 'KEYCODE_BUTTON_A' },
  { value: 97, name: 'KEYCODE_BUTTON_B' },
  { value: 98, name: 'KEYCODE_BUTTON_C' },
  { value: 99, name: 'KEYCODE_BUTTON_X' },
  { value: 100, name: 'KEYCODE_BUTTON_Y' },
  { value: 101, name: 'KEYCODE_BUTTON_Z' },
  { value: 102, name: 'KEYCODE_BUTTON_L1' },
  { value: 103, name: 'KEYCODE_BUTTON_R1' },
  { value: 104, name: 'KEYCODE_BUTTON_L2' },
  { value: 105, name: 'KEYCODE_BUTTON_R2' },
  { value: 106, name: 'KEYCODE_BUTTON_THUMBL' },
  { value: 107, name: 'KEYCODE_BUTTON_THUMBR' },
  { value: 108, name: 'KEYCODE_BUTTON_START' },
  { value: 109, name: 'KEYCODE_BUTTON_SELECT' },
  { value: 110, name: 'KEYCODE_BUTTON_MODE' },
  { value: 111, name: 'KEYCODE_ESCAPE' },
  { value: 112, name: 'KEYCODE_FORWARD_DEL' },
  { value: 113, name: 'KEYCODE_CTRL_LEFT' },
  { value: 114, name: 'KEYCODE_CTRL_RIGHT' },
  { value: 115, name: 'KEYCODE_CAPS_LOCK' },
  { value: 116, name: 'KEYCODE_SCROLL_LOCK' },
  { value: 117, name: 'KEYCODE_META_LEFT' },
  { value: 118, name: 'KEYCODE_META_RIGHT' },
  { value: 119, name: 'KEYCODE_FUNCTION' },
  { value: 120, name: 'KEYCODE_SYSRQ' },
  { value: 121, name: 'KEYCODE_BREAK' },
  { value: 122, name: 'KEYCODE_MOVE_HOME' },
  { value: 123, name: 'KEYCODE_MOVE_END' },
  { value: 124, name: 'KEYCODE_INSERT' },
  { value: 125, name: 'KEYCODE_FORWARD' },
  { value: 126, name: 'KEYCODE_MEDIA_PLAY' },
  { value: 127, name: 'KEYCODE_MEDIA_PAUSE' },
  { value: 128, name: 'KEYCODE_MEDIA_CLOSE' },
  { value: 129, name: 'KEYCODE_MEDIA_EJECT' },
  { value: 130, name: 'KEYCODE_MEDIA_RECORD' },
  { value: 131, name: 'KEYCODE_F1' },
  { value: 132, name: 'KEYCODE_F2' },
  { value: 133, name: 'KEYCODE_F3' },
  { value: 134, name: 'KEYCODE_F4' },
  { value: 135, name: 'KEYCODE_F5' },
  { value: 136, name: 'KEYCODE_F6' },
  { value: 137, name: 'KEYCODE_F7' },
  { value: 138, name: 'KEYCODE_F8' },
  { value: 139, name: 'KEYCODE_F9' },
  { value: 140, name: 'KEYCODE_F10' },
  { value: 141, name: 'KEYCODE_F11' },
  { value: 142, name: 'KEYCODE_F12' },
  { value: 143, name: 'KEYCODE_NUM_LOCK' },
  { value: 144, name: 'KEYCODE_NUMPAD_0' },
  { value: 145, name: 'KEYCODE_NUMPAD_1' },
  { value: 146, name: 'KEYCODE_NUMPAD_2' },
  { value: 147, name: 'KEYCODE_NUMPAD_3' },
  { value: 148, name: 'KEYCODE_NUMPAD_4' },
  { value: 149, name: 'KEYCODE_NUMPAD_5' },
  { value: 150, name: 'KEYCODE_NUMPAD_6' },
  { value: 151, name: 'KEYCODE_NUMPAD_7' },
  { value: 152, name: 'KEYCODE_NUMPAD_8' },
  { value: 153, name: 'KEYCODE_NUMPAD_9' },
  { value: 154, name: 'KEYCODE_NUMPAD_DIVIDE' },
  { value: 155, name: 'KEYCODE_NUMPAD_MULTIPLY' },
  { value: 156, name: 'KEYCODE_NUMPAD_SUBTRACT' },
  { value: 157, name: 'KEYCODE_NUMPAD_ADD' },
  { value: 158, name: 'KEYCODE_NUMPAD_DOT' },
  { value: 159, name: 'KEYCODE_NUMPAD_COMMA' },
  { value: 160, name: 'KEYCODE_NUMPAD_ENTER' },
  { value: 161, name: 'KEYCODE_NUMPAD_EQUALS' },
  { value: 162, name: 'KEYCODE_NUMPAD_LEFT_PAREN' },
  { value: 163, name: 'KEYCODE_NUMPAD_RIGHT_PAREN' },
  { value: 164, name: 'KEYCODE_VOLUME_MUTE' },
  { value: 165, name: 'KEYCODE_INFO' },
  { value: 166, name: 'KEYCODE_CHANNEL_UP' },
  { value: 167, name: 'KEYCODE_CHANNEL_DOWN' },
  { value: 168, name: 'KEYCODE_ZOOM_IN' },
  { value: 169, name: 'KEYCODE_ZOOM_OUT' },
  { value: 170, name: 'KEYCODE_TV' },
  { value: 171, name: 'KEYCODE_WINDOW' },
  { value: 172, name: 'KEYCODE_GUIDE' },
  { value: 173, name: 'KEYCODE_DVR' },
  { value: 174, name: 'KEYCODE_BOOKMARK' },
  { value: 175, name: 'KEYCODE_CAPTIONS' },
  { value: 176, name: 'KEYCODE_SETTINGS' },
  { value: 177, name: 'KEYCODE_TV_POWER' },
  { value: 178, name: 'KEYCODE_TV_INPUT' },
  { value: 179, name: 'KEYCODE_STB_POWER' },
  { value: 180, name: 'KEYCODE_STB_INPUT' },
  { value: 181, name: 'KEYCODE_AVR_POWER' },
  { value: 182, name: 'KEYCODE_AVR_INPUT' },
  { value: 183, name: 'KEYCODE_PROG_RED' },
  { value: 184, name: 'KEYCODE_PROG_GREEN' },
  { value: 185, name: 'KEYCODE_PROG_YELLOW' },
  { value: 186, name: 'KEYCODE_PROG_BLUE' },
  { value: 187, name: 'KEYCODE_APP_SWITCH' },
  { value: 188, name: 'KEYCODE_BUTTON_1' },
  { value: 189, name: 'KEYCODE_BUTTON_2' },
  { value: 190, name: 'KEYCODE_BUTTON_3' },
  { value: 191, name: 'KEYCODE_BUTTON_4' },
  { value: 192, name: 'KEYCODE_BUTTON_5' },
  { value: 193, name: 'KEYCODE_BUTTON_6' },
  { value: 194, name: 'KEYCODE_BUTTON_7' },
  { value: 195, name: 'KEYCODE_BUTTON_8' },
  { value: 196, name: 'KEYCODE_BUTTON_9' },
  { value: 197, name: 'KEYCODE_BUTTON_10' },
  { value: 198, name: 'KEYCODE_BUTTON_11' },
  { value: 199, name: 'KEYCODE_BUTTON_12' },
  { value: 200, name: 'KEYCODE_BUTTON_13' },
  { value: 201, name: 'KEYCODE_BUTTON_14' },
  { value: 202, name: 'KEYCODE_BUTTON_15' },
  { value: 203, name: 'KEYCODE_BUTTON_16' },
  { value: 204, name: 'KEYCODE_LANGUAGE_SWITCH' },
  { value: 205, name: 'KEYCODE_MANNER_MODE' },
  { value: 206, name: 'KEYCODE_3D_MODE' },
  { value: 207, name: 'KEYCODE_CONTACTS' },
  { value: 208, name: 'KEYCODE_CALENDAR' },
  { value: 209, name: 'KEYCODE_MUSIC' },
  { value: 210, name: 'KEYCODE_CALCULATOR' },
  { value: 211, name: 'KEYCODE_ZENKAKU_HANKAKU' },
  { value: 212, name: 'KEYCODE_EISU' },
  { value: 213, name: 'KEYCODE_MUHENKAN' },
  { value: 214, name: 'KEYCODE_HENKAN' },
  { value: 215, name: 'KEYCODE_KATAKANA_HIRAGANA' },
  { value: 216, name: 'KEYCODE_YEN' },
  { value: 217, name: 'KEYCODE_RO' },
  { value: 218, name: 'KEYCODE_KANA' },
  { value: 219, name: 'KEYCODE_ASSIST' },
  { value: 220, name: 'KEYCODE_BRIGHTNESS_DOWN' },
  { value: 221, name: 'KEYCODE_BRIGHTNESS_UP' },
  { value: 222, name: 'KEYCODE_MEDIA_AUDIO_TRACK' },
  { value: 223, name: 'KEYCODE_SLEEP' },
  { value: 224, name: 'KEYCODE_WAKEUP' },
  { value: 225, name: 'KEYCODE_PAIRING' },
  { value: 226, name: 'KEYCODE_MEDIA_TOP_MENU' },
  { value: 227, name: 'KEYCODE_11' },
  { value: 228, name: 'KEYCODE_12' },
  { value: 229, name: 'KEYCODE_LAST_CHANNEL' },
  { value: 230, name: 'KEYCODE_TV_DATA_SERVICE' },
  { value: 231, name: 'KEYCODE_VOICE_ASSIST' },
  { value: 232, name: 'KEYCODE_TV_RADIO_SERVICE' },
  { value: 233, name: 'KEYCODE_TV_TELETEXT' },
  { value: 234, name: 'KEYCODE_TV_NUMBER_ENTRY' },
  { value: 235, name: 'KEYCODE_TV_TERRESTRIAL_ANALOG' },
  { value: 236, name: 'KEYCODE_TV_TERRESTRIAL_DIGITAL' },
  { value: 237, name: 'KEYCODE_TV_SATELLITE' },
  { value: 238, name: 'KEYCODE_TV_SATELLITE_BS' },
  { value: 239, name: 'KEYCODE_TV_SATELLITE_CS' },
  { value: 240, name: 'KEYCODE_TV_SATELLITE_SERVICE' },
  { value: 241, name: 'KEYCODE_TV_NETWORK' },
  { value: 242, name: 'KEYCODE_TV_ANTENNA_CABLE' },
  { value: 243, name: 'KEYCODE_TV_INPUT_HDMI_1' },
  { value: 244, name: 'KEYCODE_TV_INPUT_HDMI_2' },
  { value: 245, name: 'KEYCODE_TV_INPUT_HDMI_3' },
  { value: 246, name: 'KEYCODE_TV_INPUT_HDMI_4' },
  { value: 247, name: 'KEYCODE_TV_INPUT_COMPOSITE_1' },
  { value: 248, name: 'KEYCODE_TV_INPUT_COMPOSITE_2' },
  { value: 249, name: 'KEYCODE_TV_INPUT_COMPONENT_1' },
  { value: 250, name: 'KEYCODE_TV_INPUT_COMPONENT_2' },
  { value: 251, name: 'KEYCODE_TV_INPUT_VGA_1' },
  { value: 252, name: 'KEYCODE_TV_AUDIO_DESCRIPTION' },
  { value: 253, name: 'KEYCODE_TV_AUDIO_DESCRIPTION_MIX_UP' },
  { value: 254, name: 'KEYCODE_TV_AUDIO_DESCRIPTION_MIX_DOWN' },
  { value: 255, name: 'KEYCODE_TV_ZOOM_MODE' },
  { value: 256, name: 'KEYCODE_TV_CONTENTS_MENU' },
  { value: 257, name: 'KEYCODE_TV_MEDIA_CONTEXT_MENU' },
  { value: 258, name: 'KEYCODE_TV_TIMER_PROGRAMMING' },
  { value: 259, name: 'KEYCODE_HELP' },
  { value: 260, name: 'KEYCODE_NAVIGATE_PREVIOUS' },
  { value: 261, name: 'KEYCODE_NAVIGATE_NEXT' },
  { value: 262, name: 'KEYCODE_NAVIGATE_IN' },
  { value: 263, name: 'KEYCODE_NAVIGATE_OUT' },
  { value: 264, name: 'KEYCODE_STEM_PRIMARY' },
  { value: 265, name: 'KEYCODE_STEM_1' },
  { value: 266, name: 'KEYCODE_STEM_2' },
  { value: 267, name: 'KEYCODE_STEM_3' },
  { value: 268, name: 'KEYCODE_DPAD_UP_LEFT' },
  { value: 269, name: 'KEYCODE_DPAD_DOWN_LEFT' },
  { value: 270, name: 'KEYCODE_DPAD_UP_RIGHT' },
  { value: 271, name: 'KEYCODE_DPAD_DOWN_RIGHT' },
  { value: 272, name: 'KEYCODE_MEDIA_SKIP_FORWARD' },
  { value: 273, name: 'KEYCODE_MEDIA_SKIP_BACKWARD' },
  { value: 274, name: 'KEYCODE_MEDIA_STEP_FORWARD' },
  { value: 275, name: 'KEYCODE_MEDIA_STEP_BACKWARD' },
  { value: 276, name: 'KEYCODE_SOFT_SLEEP' },
  { value: 277, name: 'KEYCODE_CUT' },
  { value: 278, name: 'KEYCODE_COPY' },
  { value: 279, name: 'KEYCODE_PASTE' },
  { value: 280, name: 'KEYCODE_SYSTEM_NAVIGATION_UP' },
  { value: 281, name: 'KEYCODE_SYSTEM_NAVIGATION_DOWN' },
  { value: 282, name: 'KEYCODE_SYSTEM_NAVIGATION_LEFT' },
  { value: 283, name: 'KEYCODE_SYSTEM_NAVIGATION_RIGHT' },
  { value: 284, name: 'KEYCODE_ALL_APPS' },
  { value: 285, name: 'KEYCODE_REFRESH' },
  { value: 286, name: 'KEYCODE_THUMBS_UP' },
  { value: 287, name: 'KEYCODE_THUMBS_DOWN' },
  { value: 288, name: 'KEYCODE_PROFILE_SWITCH' }
]

export const filteredKeycodes = computed(() => {
  const q = keyRefSearch.value.trim().toLowerCase()
  if (!q) return KEYCODE_TABLE
  return KEYCODE_TABLE.filter(r =>
    r.name.toLowerCase().includes(q) ||
    String(r.value).includes(q) ||
    tKeycode(r.name).toLowerCase().includes(q)
  )
})

// ---------- 输入文本 / 点击 / 滑动 ----------
export const INPUT_TYPES = {
  text:  { titleKey: 'input.type.text', channel: 'adb:inputText',  build: (v) => ({ text: v.text }) },
  tap:   { titleKey: 'input.type.tap', channel: 'adb:inputTap',   build: (v) => ({ x: Number(v.x), y: Number(v.y) }) },
  swipe: { titleKey: 'input.type.swipe', channel: 'adb:inputSwipe', build: (v) => ({ x1: Number(v.x1), y1: Number(v.y1), x2: Number(v.x2), y2: Number(v.y2), duration: (v.duration == null || v.duration === '') ? null : Number(v.duration) }) }
}

export const INPUT_VALUE_FIELDS = {
  text:  [ { prop: 'text', labelKey: 'input.valueText', type: 'text' } ],
  tap:   [ { prop: 'x', label: 'X', type: 'num' }, { prop: 'y', label: 'Y', type: 'num' } ],
  swipe: [ { prop: 'x1', label: 'X1', type: 'num' }, { prop: 'y1', label: 'Y1', type: 'num' }, { prop: 'x2', label: 'X2', type: 'num' }, { prop: 'y2', label: 'Y2', type: 'num' }, { prop: 'duration', labelKey: 'input.duration', type: 'num', optional: true } ]
}

export const textButtons = ref([])

export const tapButtons = ref([])

export const swipeButtons = ref([])

export const inputModalOpen = ref(false)

export const inputModalType = ref('text')

export const inputManaging = ref(false)

export const inputGroup = ref(ALL_GROUPS)

export const inputColorEditIndex = ref(null)

export const newInputName = ref('')

export const newInputGroup = ref('')

export const newInputVal = reactive({ text: '', x: '', y: '', x1: '', y1: '', x2: '', y2: '', duration: '' })

// 按输入类型取对应按钮组（state 层选择器，供 inputButtons computed 与操作层共用）
export function inputButtonsOf(t) { return t === 'text' ? textButtons.value : t === 'tap' ? tapButtons.value : swipeButtons.value }

export const inputButtons = computed(() => inputButtonsOf(inputModalType.value))

export const inputGroups = computed(() => {
  const s = new Set([PRESET_GROUP])
  inputButtons.value.forEach((k) => s.add(k.group || NO_GROUP))
  return [...s]
})

export const displayInputs = computed(() => {
  const all = inputButtons.value
  return inputGroup.value === ALL_GROUPS ? all : all.filter((k) => (k.group || PRESET_GROUP) === inputGroup.value)
})
