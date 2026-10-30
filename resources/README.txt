把以下两个二进制放到本目录（resources/），打包后它们会出现在 process.resourcesPath/resources 下：

1. adb.exe         —— 建议用固定版本（如 platform-tools 35.0.x），避免开发机/设备端 adb server 版本冲突。
2. aapt.exe        —— 用于离线解析本地 APK / 已拉取的设备 APK（dump badging、permissions）。
   （可选）aapt2.exe —— 若后续需要 aapt2 专属能力再补充，当前工具只用 aapt.exe。

注意：
- 不要把这些二进制提交进 git 仓库（体积大且涉及版本管理），建议用 .gitignore 忽略 resources/*.exe。
- 开发期若本机 PATH 已能找到 adb / aapt，工具会优先用 resources/ 下的，找不到再回退 PATH。
- 要规避多版本 adb server 冲突，可改 tools.js 用 `adb -P 5038` 指定独立端口并 bundle 对应版本。
