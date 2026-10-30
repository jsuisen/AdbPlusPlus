# ADB++

工程级 ADB 桌面实用工具，支持各种细粒度配置，依赖 adb、aapt。

参考：

- Android Studio Logcat(lengency)

- Android Studio Logcat 

- Android Turbo Tools

- SecureCRT

- WorkBuddy

- Notepad++

- ADB++

## 目录结构

```
AdbPlusPlus/
├─ main/                     主进程（Node，ESM）：spawn adb/aapt、IPC 注册
│  ├─ index.js               入口（package.json main 指向）：窗口创建 + 各模块 IPC 注册
│  ├─ preload.js             安全桥：window.api（invoke/send/on + 通道白名单）
│  ├─ adb.js / logcat.js / media.js / netcap.js / apk.js / config.js
│  │  / file.js / fonts.js / devices.js / applog.js / tools.js
│  └─ device-scripts/        设备端 shell 脚本（运行时推送设备）
├─ shared/                   主进程/渲染进程共用：ipc-channels.js（IPC 通道常量 + 白名单）
├─ src/                      渲染进程（Vue 3）
│  ├─ App.vue                根组件（弹窗均已组件化）
│  ├─ components/            25 个组件：modals/（21 弹窗）+ 4 个非模态组件
│  ├─ composables/           状态（state.js barrel + state/ 按域 9 文件）、行为（useXxx）、shared.js 纯函数
│  └─ styles.css             全局样式
├─ tests/                    node:test 单测（npm test）
├─ scripts/                  dev.js 开发启动器；check.mjs 静态验证管线（npm run check）
├─ resources/                adb.exe / aapt.exe（不入库）；icon.png
├─ adbtool-config.sample.json 运行时配置样例（真实配置不入库）
├─ docs/                     方法论文档体系
├─ index.html / vite.config.js / electron-builder.yml / jsconfig.json / package.json
└─ .gitignore
```

## 前置

- Node.js 22.x（开发机用，仅跑 Vite/打包脚本；Electron 内置的是 Chromium 138 + Node 22.x 组合）
- 把 `adb.exe`、`aapt.exe` 放进 `resources/`（见 resources/README.txt）

## 开发

```bash
npm install
npm run dev          # 启动 Vite(5173) + Electron，加载开发服务器
npm run check        # 提交前静态验证（tsc/通道校验/无环/barrel/模板绑定）
npm test             # 纯函数与轮询列表工厂单测
```

## 打包

三条命令都先做 `vite build` 把渲染产物写进 dist/，再交给 electron-builder。区别只在打包目标：

| 命令 | 等价命令 | 产物 |
|------|----------|------|
| `npm run build` | `vite build && electron-builder --win nsis` | 安装版 `release/*.exe`（NSIS 安装包） |
| `npm run dist`  | 同上（与 build 完全一致） | 安装版，同 build |
| `npm run pack`  | `vite build && electron-builder --win dir` | **免安装绿色版目录 `release/win-unpacked/`** |

- 产物目录由 `electron-builder.yml` 的 `directories.output: release` 决定。
- `pack` 用 `dir` 目标，只产出解包后的程序目录、不生成安装包：把 `release/win-unpacked/` 整目录拷到任意 Windows 机器，双击里面的 `adb++.exe` 即可运行，无需安装。
- `build` / `dist` 用 `nsis` 目标，产出可分发安装包 `release/*.exe`。

## 安全要点

- 所有子进程调用统一在主进程用参数数组 `spawn(tool, [args...])`，绝不拼接 shell 字符串，防命令注入。
- 渲染进程 `nodeIntegration:false` + `contextIsolation:true`，只能通过 preload 的 `window.api` 通信；**invoke/send/on 三方法均有通道白名单**（`shared/ipc-channels.js`），未登记通道直接拒绝。
- 运行时配置 `adbtool-config.json` 不入库（默认 exe/工程根同级，可自定义路径）；结构样例见 `adbtool-config.sample.json`。
- 应用版本号以 package.json semver 为准，关于弹窗运行时读取。

## 已知限制 / 后续可增强

- Logcat 渲染采用「全缓冲 + 过滤后截取尾部渲染」策略：每台设备的日志全量缓存在内存（`logsMap`），`displayLogs` 先按级别 / Tag / 关键字 / 包名过滤，再 `slice` 取尾部至多 `maxRender`（默认 20000，可在「设置 - 通用」中修改；该值越大 DOM 节点越多，过大可能卡顿，按需调整）行交给 Vue 渲染。因渲染行数已封顶，普通吞吐下 DOM 规模可控；若日志刷得很快仍不够看，可调大该值，或进一步考虑 `vue-virtual-scroller` 做虚拟列表。
- 录屏依赖设备 `screenrecord`，单段 ≤3 分钟；需要更长可用 `screenrecord --output-format=h264 - | ffmpeg` 流式方案（需自带 ffmpeg）。
- 环境提示：本机若同时存在多个版本的 adb（如雷电模拟器自带 adb 与 resources/adb.exe 版本不同），会互相重启对方 server，导致日志采集/进程检测间歇性无数据且无报错；`adb kill-server` 或统一两端 adb 版本可解。
