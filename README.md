# <img src="android/branding/rs-cursor-logo.png" width="44" height="44" alt=""> RS Cursor

**在安卓平板上遥控电脑里的 Cursor。** 电脑上的 Cursor 照常跑 AI Agent，你拿着平板在沙发上派活、看进度、改需求。平板上看到的就是 Cursor 里的同一个对话，不是另开的一份副本。

RS Cursor 由两部分组成：

- **安卓平板 App**：Jetpack Compose 原生界面，位于 [`android/`](android/)。
- **电脑主机服务**：一个跑在 Cursor 旁边的 Node 进程（端口 4331），负责读写 Cursor 的对话，同时提供网页版和可选的 Telegram 机器人。它基于 Simon Pedersen 的开源项目 [Auto](https://github.com/nitech/auto)。

> **非官方项目。** 与 Anysphere / Cursor 没有任何关系。它通过 Cursor 的 Agent CLI、IDE 调试端口和 Cursor 自己存在本地的数据来工作，Cursor 更新后可能失效。请自行承担风险，并留意你账号适用的 Cursor 条款。

## 平板端特性

### 原生界面
- Jetpack Compose 从零编写，不是网页套壳。
- 沉浸式光感背景加液态玻璃面板。菜单、弹窗、设置页都有弹性进出场动画，关闭侧栏时聊天区跟着宽度动画铺开。
- 连上主机之前显示骨架屏。主机换了 IP 时，加载页直接提供「重试」和「更改主机地址」，不会卡死。

### 侧栏与电脑上的 Cursor 一致
- 结构和 Cursor Agents 侧栏相同：Pinned 在上，下面按仓库分组，按 git 远程地址对上本地文件夹。
- 每个对话显示它在 Cursor 里设的**图标和颜色**。字形直接取自电脑上安装的 Cursor 图标字体，主机转成 TTF 下发给平板，所以和 Cursor 一模一样。
- 长按对话弹出与 Cursor 相同的菜单：置顶 / 重命名 / 改图标 / 标为未读 / 复刻 / 移动到 / 复制 / 归档。全部调用 Cursor 自己的后台服务，**电脑屏幕上不会弹出任何东西**，Cursor 最小化也能用。
- 「改图标」是和 Cursor 一样的字形网格，带 10 种颜色。
- 正在干活的对话，标题上会扫过一道光，前面有转圈。

### 两端输入框实时同步
- 平板上打的字会出现在电脑上 Cursor 的输入框里，反过来也一样。
- 谁在打字谁拿推送权，另一端立即让出，不会互相覆盖或回跳。拥有推送权的一端每秒强制同步一次全文。
- 哪边按发送，就发哪边的内容。

### 新建对话不打扰电脑
- 在平板上点 New Chat，电脑上不弹窗、不启动、不抢焦点。
- 第一条消息发出时，主机通过 Cursor 的 `agentRepositoryService.createAgent` 在后台建好对话，它直接出现在 Cursor 侧栏里开始运行。

### 对话体验
- 思考过程和子任务实时滚动，结束后自动折叠，并显示「Worked for 7m 3s」。
- Agent 忙时照样能发消息，消息会排进 Cursor 风格的「N Queued」卡片。
- 上滑加载更早的历史；能发图片，点开缩略图看原图；正文按 Markdown 渲染。
- 输入框内的模型按钮会打开和 Cursor 一样的参数菜单（Fast / Context / Effort / Model），和电脑共用同一个模型设置。
- 断线自动重连，并显示失败原因。

## 主机端能力（来自 Auto）

| | |
| --- | --- |
| **桌面对话** | Cursor 里的对话按项目列出，平板 / 网页 / Telegram 上继续的是同一个对话 |
| **会话** | 可以同时开多个，各有自己的文件夹和记录，重启后接着跑 |
| **完整输出** | 正文、思考、每次工具调用的输入和结果、diff、终端输出，原样记录、原样显示 |
| **审批与提问** | Cursor 弹出的确认、Agent 提的选择题、Plan 卡片，都能在手机上点 |
| **网页版 / Telegram** | 浏览器打开 `http://<主机>:4331/`（可装成 PWA）；Telegram 机器人可选 |
| **自重启** | `POST /api/restart`，等当前一轮结束后由守护进程拉起 |

## 安装

需要 **Windows 电脑 + Cursor + Node 20+**，平板和电脑在同一局域网，或在同一个 [Tailscale](https://tailscale.com) 网络里。

### 1. 电脑：主机服务

```powershell
git clone https://github.com/RyanYu0118/RS-Cursor-For-Android.git
cd RS-Cursor-For-Android
npm install                  # 顺带打印环境检查清单
npm run autostart:install    # 安装开机自启的计划任务
Start-ScheduledTask -TaskName AutoSupervise
```

Cursor 必须带调试端口启动，否则主机没法和 IDE 交互：

```powershell
& "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" --remote-debugging-port=9222
```

建议把这个参数加到 Cursor 的开始菜单快捷方式里。检查是否正常：浏览器打开 `http://127.0.0.1:4331/api/health`。

更详细的步骤（Tailscale、Cursor CLI、防火墙、Telegram）见 [docs/install.md](docs/install.md)。

### 2. 平板：安装 App

用 JDK 17 编译：

```powershell
cd android
.\gradlew.bat assembleDebug
```

把 `android/app/build/outputs/apk/debug/RS Cursor - <版本号>.apk` 装到平板上。首次打开时填写主机地址，例如 `http://100.x.y.z:4331`。

版本号格式为 `<年>m<月><字母>`：`26m10a` 是 2026 年 10 月的第一个版本，同月依次为 `26m10b`、`26m10c`……

## 安全

主机**没有自己的登录系统**，访问控制靠网络本身：
- 只在局域网或 Tailscale 内使用。
- 不要把 4331 端口映射到公网，也不要对它开启 Tailscale Funnel。

默认 `AUTO_POLICY=auto`，Agent 执行命令不会询问。共用电脑请在 `.env` 里改成 `ask-on-write`。

## 目录

| 路径 | 用途 |
| --- | --- |
| `android/` | RS Cursor 安卓平板 App（Compose） |
| `src/server/index.mjs` | 主机：HTTP、WebSocket、会话 API、网页版 |
| `src/core/` | 与 Cursor 交互：对话镜像、侧栏、图标、输入同步等 |
| `scripts/` | 环境检查、守护进程、测试 |
| `.wiki/` | 给 Agent 看的项目知识库（从 `.wiki/index.md` 开始） |
| `state/` | 会话与记录，已 gitignore |

参与开发请先看 [AGENTS.md](AGENTS.md)：改代码要跑 `npm test`，通过后提交。

## 致谢与许可

- 主机端基于 Simon Pedersen 的 [Auto](https://github.com/nitech/auto)。RS Cursor 在它的基础上加了安卓平板客户端，以及输入同步、侧栏镜像、后台新建对话、图标字体等功能。
- 许可：[MIT](LICENSE)。依赖的第三方包（`ws`、`@xterm/*`、`node-pty`、`wawoff2` 等）的版权声明归各自所有。
