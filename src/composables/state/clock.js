// 共享状态：顶部标题栏「设备时钟」
// 显示当前已连接且选中设备的内部时间，格式 MM-dd HH:mm:ss（如 11-15 16:58:12）。
import { ref } from 'vue'

// 启动后默认 false：只有用户**点击过一次时钟**才置 true 并开始计时。
// 刻意只放内存、不写 cfg，应用每次启动都复位 —— 即每次启动都必须重新点一次。
export const deviceClockActive = ref(false)

export const deviceClockText = ref('-- --:--:--')
export const deviceClockOk = ref(false)        // 是否成功与设备同步（决定小圆点/文字配色）
export const deviceClockSerial = ref('')       // 当前显示的是哪台设备的时间
