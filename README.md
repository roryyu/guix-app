# GUIX App · 原生图形实验室与 GLSL 编辑器

一个用于探索桌面 GPU 图形渲染的示例工程，包含两个独立应用：

| 应用 | 用途 | 渲染方式 | 启动命令 |
| --- | --- | --- | --- |
| **GPUIX Lab** | 几何、柱形图与 SVG 原生渲染示例 | React → GPUIX → Rust / GPUI → GPU | `npm start` |
| **GLSL Studio** | 实时编辑和编译 GLSL 着色器 | Swift / AppKit → WKWebView → WebGL | `npm run editor:start` |

GPUIX Lab 基于 [remorses/gpuix](https://github.com/remorses/gpuix)。GLSL Studio 从原 `glsl-editor.html` 迁移而来，保留编辑器交互和默认 NEBULA 效果，并拆分为可维护的模块。

**两者不共享渲染后端。** 当前使用的 GPUIX 0.9.0 没有本项目所需的公开自定义 Shader / WebView 接口，因此编辑器使用系统 WKWebView 独立运行，不是 GPUIX 原生 Shader 扩展。两个应用均不依赖 Electron，也不需要后端服务。

## 快速开始

### 开发环境

- 推荐使用 **Apple Silicon Mac**，本项目已在该环境完成构建与运行验证。
- **Bun ≥ 1.3.5**：安装依赖、运行 TypeScript 和构建独立二进制。
- **Node.js ≥ 22**：配合 npm 脚本、TypeScript 和 Vitest。
- 构建 GLSL Studio 或生成 `.app` / `.dmg` 时，需要 **Xcode Command Line Tools**，提供 `xcrun swiftc`；打包还使用系统的 `plutil`、`codesign` 和 `hdiutil`。

应用包声明的最低 macOS 版本为 13.0；这不代表已逐一验证所有 macOS 版本。当前 GPUIX 的 macOS npm 原生模块仅支持 arm64。编辑器构建脚本也提供 x86_64 分支，但尚未在 Intel Mac 验证；默认打包两个应用时仍要求 arm64。

### 安装与启动

以下命令均在 `guix-app` 目录执行：

```bash
# 使用仓库中的 bun.lock 安装依赖
bun install --frozen-lockfile

# 启动原生 GPUIX 图形实验室
npm start

# 或：以热重载方式开发 GPUIX 示例
npm run dev

# 构建并打开 GLSL 编辑器的 macOS 应用
npm run editor:start
```

首次安装依赖需要网络；应用运行时使用本地资源，无 API Key、数据库或 `.env` 配置要求。

`editor:start` 每次都会构建编辑器，再通过 `open` 打开应用。修改编辑器源码后，退出旧窗口并重新运行此命令；它不是热重载服务。不要直接打开 `shader-editor/index.html`，该文件引用的 `main.js` 由构建脚本生成。

## 功能概览

### GPUIX Lab

- **几何构成**：环形 / 矩阵布局切换，图元选择，圆角与渐变，原生位置和尺寸过渡。
- **数据图表**：柱形图、高度过渡、样本选择和确定性的示例数据换组。
- **矢量图案**：直接传入 SVG 源码，切换图案和单色蒙版配色。
- 公共控制：三种配色、图元数量、参考网格、动画开关和一键重置。
- 支持 Tab 聚焦、Enter / Space 操作，并显示核心 API 示意片段。

这里的 JSX 由 GPUIX 渲染，不使用 ReactDOM。React 提交状态和动画目标值，原生层完成动画插值与绘制；图表数据为本地示例数据，并非接入真实业务接口。

### GLSL Studio

- 左侧实时 WebGL 预览，右侧 FRAGMENT / VERT 源码编辑与行号。
- **600ms 防抖自动编译**、手动编译、编译日志及用户源码行号映射。
- 编译失败保留上一次有效程序，不用错误源码替换当前画面。
- NEBULA、GRID、WAVE 三段独立 Shader，切换预设会实际改变渲染效果。
- 播放 / 暂停、时间与 FPS 显示、鼠标 uniform、可拖动分隔条。
- 四个实时参数滑块；无需重新编译即可更新 uniform。
- 自动保存三个预设的 Fragment 草稿及共用 Vertex 源码到 `localStorage`。
- WebGL 上下文丢失后尝试恢复最后一次有效 Shader。
- 根据画布尺寸调整分辨率，DPR 上限为 2；暂停或页面隐藏时停止持续重绘。

编辑器移除了原 HTML 的远程字体依赖，使用系统字体与本地静态资源；同时修正兼容函数替换、uniform 重复注入、失败编译资源清理及预设按钮不改变画面等问题。原参考 HTML 无需参与构建。

### 编辑器操作

| 操作 | 方式 |
| --- | --- |
| 编译当前 Vertex + Fragment | “编译运行”、`⌘Enter` / `Ctrl+Enter`、`⌘S` / `Ctrl+S` |
| 插入两个空格 | 编辑区内按 Tab |
| 切换 Shader 类型 | FRAGMENT / VERT 标签 |
| 调整两栏宽度 | 拖动分隔条，或聚焦分隔条后按左右方向键 |
| 恢复代码 | “恢复当前预设”：恢复当前 Fragment 和共用的默认 Vertex |
| 复制、粘贴、撤销 | macOS 原生“编辑”菜单及对应快捷键 |

`⌘S` / `Ctrl+S` 用于编译和保存本地草稿，不是导出文件。恢复当前预设会覆盖对应草稿；草稿存储不是文件备份，也不保证应用路径变更后的迁移。滑块数值和播放状态不持久化。

| 参数 | 范围 | 默认值 | 作用 |
| --- | --- | --- | --- |
| SPEED | 0–3 | 1.0 | 缩放 `iTime` / `u_time` 的推进速度 |
| SCALE | 1–60 | 28.0 | 写入 `u_scale`，控制 Shader 的空间尺度 |
| ITER | 1–40 | 17 | 写入整数 `u_iterations`，控制外层迭代或波形数量 |
| DETAIL | 1–60 | 27 | 写入整数 `u_detail`，控制 NEBULA 内层迭代 |

参数是否改变画面取决于当前 Shader 是否使用对应 uniform。例如 GRID 不使用 ITER / DETAIL，WAVE 不使用 DETAIL。SPEED 为 0 仅冻结时间；要停止持续绘制，请使用暂停按钮。

## Shader 编写约定

编辑器使用 **WebGL 1 / GLSL ES 1.0**。Fragment 支持直接编写 `main()`，也支持自动包装 Shadertoy 风格的 `mainImage()`：

```glsl
void mainImage(out vec4 color, vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    float wave = sin(uv.x * u_scale + iTime);
    vec3 tint = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + wave);
    color = vec4(tint, 1.0);
}
```

Vertex 必须使用 `attribute vec2 a_pos` 作为顶点输入。默认源码：

```glsl
attribute vec2 a_pos;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
```

### 内置 uniform

未在 Fragment 中声明的内置 uniform 会自动注入；自行声明时应保持相同类型。

| 类型 | 名称 |
| --- | --- |
| `vec3` | `iResolution` |
| `float` | `iTime`、`iTimeDelta`、`iFrameRate`、`iSampleRate` |
| `int` | `iFrame` |
| `vec4` | `iMouse`、`iDate` |
| `sampler2D` | `iChannel0`–`iChannel3` |
| `vec3[4]` / `float[4]` | `iChannelResolution` / `iChannelTime` |
| `vec2` | `u_resolution`、`u_mouse` |
| `float` | `u_time`、`u_scale`、`u_preset` |
| `int` | `u_iterations`、`u_detail` |

支持 `frac → fract`、`lerp → mix`、`ddx/ddy → dFdx/dFdy` 和 `saturate` 兼容处理。导数函数依赖 GPU 的 `OES_standard_derivatives` 扩展。

### 能力边界

- 不支持 `#version 300 es`、WebGL 2 或完整 HLSL 语法。
- 不是完整 Shadertoy 运行时，不支持多 Buffer 通道、音频输入或纹理上传。
- `iChannel0`–`iChannel3` 为 **1×1 黑色占位纹理**；`iSampleRate` 是固定兼容值，不表示存在音频输入。
- GLSL ES 1.0 中应使用常量循环上界，再通过 uniform 条件 `break`，内置 NEBULA 即采用此方式。
- 复杂 Shader、高迭代次数和高分辨率可能明显增加 GPU 负载。
- WKWebView 只加载应用包内网页，CSP 禁止网络请求；页面没有原生执行桥。

## 架构与目录

```text
GPUIX Lab
  src/main.tsx → React 组件与 reducer
              → @gpuix/react 自定义 reconciler
              → commit 批量变更 → @gpuix/native / Rust RetainedTree
              → GPUI 布局与 GPU 绘制（macOS 使用 Metal）

GLSL Studio
  desktop/main.swift → AppKit 窗口、菜单与 WKWebView
                     → 包内 HTML / CSS / JavaScript
                     → main.ts 编辑器交互
                     → source.ts 源码预处理
                     → renderer.ts WebGL 编译、uniform 与绘制
```

```text
guix-app/
├── src/                       # GPUIX 原生示例
│   ├── main.tsx               # 原生窗口入口
│   ├── App.tsx                # 主界面与状态编排
│   ├── model.ts               # reducer、布局与示例数据
│   ├── theme.ts               # 主题与配色
│   └── components/            # 场景、按钮与参数控件
├── shader-editor/             # GLSL 编辑器前端
│   ├── index.html             # 编辑器页面结构
│   ├── style.css              # 本地样式与响应式布局
│   ├── main.ts                # 编辑、草稿、参数与面板交互
│   ├── presets.ts             # 预设、默认 Vertex 和滑块定义
│   ├── source.ts              # GLSL / Shadertoy 兼容处理
│   └── renderer.ts            # WebGL 资源、编译和渲染生命周期
├── desktop/main.swift         # macOS WKWebView 外壳
├── scripts/
│   ├── macos.ts               # 前端、Swift、App 和 DMG 构建
│   ├── package-macos.ts        # 打包 CLI 入口
│   ├── verify-live.ts          # GPUIX 真实窗口验证
│   └── verify-editor.ts        # WKWebView 真实 GPU 验证
├── tests/                     # 单元、原生组件与编辑器冒烟测试
├── artifacts/                 # 测试生成的截图与脚本，不纳入版本管理
├── dist/                      # 二进制、应用包、DMG 和构建缓存
├── bun.lock                   # Bun 依赖锁文件
├── tsconfig.json
└── package.json
```

主要依赖为 React 19.2.4、`@gpuix/react` 0.9.0、`@gpuix/native` 0.9.0、TypeScript 和 Vitest。两个 GPUIX 包精确锁定为相同版本；升级时应同步升级并重新执行原生测试。

## 构建与 DMG 打包

```bash
# 仅生成 GPUIX 独立可执行文件：dist/guix-app
npm run build

# 仅生成 GPUIX Lab 的 .app
npm run app:build

# 仅生成 GLSL Studio 的 .app
npm run editor:build

# 单独打包 GPUIX Lab，生成其 .app 和 .dmg
npm run package:app

# 单独打包 GLSL Studio，生成其 .app 和 .dmg
npm run package:editor

# 可选：一起打包两个应用，各自生成 .app 和 .dmg
npm run package:dmg
```

`npm run build` 不构建编辑器，也不生成 DMG。`package:app` 只打包 GPUIX Lab，`package:editor` 只打包 GLSL Studio，均不构建另一应用；`package:dmg` 保留双应用一起打包的行为。仅需要应用包时，分别使用 `app:build` / `editor:build`。`.app` / `.dmg` 构建仅支持 macOS。

当前版本在 arm64 环境的主要产物：

```text
dist/
├── guix-app                         # npm run build 的独立二进制
├── editor-web/                      # 打包后的 HTML、CSS、main.js
└── macos/
    ├── GLSL Studio.app
    ├── GPUIX Lab.app
    ├── glsl-studio-1.0.0-arm64.dmg
    └── guix-app-1.0.0-arm64.dmg
```

DMG 文件名取自 `package.json` 版本和当前构建架构。编辑器 App 内包含 Swift 可执行程序及 `Contents/Resources/web/`；GPUIX App 内包含 Bun 编译的独立可执行程序，运行成品不需要另行安装 Bun 或 Node.js。

打包会检查 `Info.plist`、执行本地 ad-hoc 签名和签名验证，并通过 `hdiutil verify` 校验 DMG。每个 DMG 包含应用和 `Applications` 拖放入口；打开 DMG 后可将应用拖入应用程序目录。打包命令本身不会安装应用。

**当前没有 Developer ID 签名或 Apple 公证。** 从其他设备或网络获取的包可能被 Gatekeeper 拦截。面向外部用户分发前，需要另行配置 Developer ID 签名与公证流程；本地签名通过不等同于可直接公开分发。

重复构建会覆盖同名应用和 DMG，并在 `dist/` 保留 Swift 缓存及独立 DMG 暂存目录。不要将手工维护的文件放入构建产物目录。

## 测试与验证

```bash
# TypeScript 全量类型检查
npm run typecheck

# 逻辑、GLSL 预处理与 GPUIX 原生组件测试
npm test

# GPUIX 源码启动后的真实窗口交互与截图
npm run test:live

# GPUIX 独立二进制验证，需先执行 npm run build
npm run test:live -- --binary

# 重新构建编辑器，并在真实 WKWebView 中测试
npm run test:editor

# 编辑器最小窗口 900 × 680 验证
npm run test:editor -- --small-window
```

也可以验证已经构建或挂载在 DMG 中的 App，而不重新构建：

```bash
npm run test:editor -- "--app=$PWD/dist/macos/GLSL Studio.app"
npm run test:live -- "--app=$PWD/dist/macos/GPUIX Lab.app"
```

验证分为三个层次：

1. **Vitest**：当前共 23 项测试，覆盖状态边界、布局、数据、GLSL 预处理，以及 GPUIX 组件交互和动画。
2. **GPUIX 原生窗口**：通过框架自动化协议切换几何 / 图表 / SVG 场景，验证选中、配色、重置并保存 GPU 截图。
3. **真实 WKWebView**：验证默认 Shader、编译错误回退、实际像素、uniform、参数与鼠标坐标、防抖、快捷键、分栏、上下文恢复、预设和草稿保存。

原生测试需要可用的图形桌面与 GPU 环境，不能仅靠无图形环境的类型检查替代。编辑器测试使用非持久 WebKit 数据存储，避免覆盖正常使用的草稿；测试窗口会临时保持可见以避免遮挡节流，但不主动抢占键盘焦点，结束后自动关闭。

本地已验证：类型检查、23 项测试、编辑器常规 / 最小窗口，以及两个 DMG 挂载后的应用运行。其他操作系统和 Intel Mac 未在本项目中完成验证。

截图在运行对应测试后生成：
- [GLSL 编辑器](artifacts/editor-webkit.png)
- [GLSL 编辑器最小窗口](artifacts/editor-webkit-small.png)
- [GPUIX 几何场景](artifacts/live-geometry.png)
- [GPUIX 图表场景](artifacts/live-chart.png)
- [GPUIX SVG 场景](artifacts/live-vector.png)

`artifacts/` 不纳入版本管理，新检出的工程需要先运行测试才会出现这些文件。

## 常见问题

- **`npm start` 没有打开 Shader 编辑器？** 它启动的是 GPUIX Lab。编辑器使用 `npm run editor:start`。
- **提示找不到 `bun`？** 本项目的运行和构建脚本依赖 Bun；即使通过 npm 执行，也需要 Bun 在 `PATH` 中。
- **Swift 构建找不到工具链？** 安装 Xcode Command Line Tools，并用 `xcrun --find swiftc` 检查。
- **打开源码 HTML 后没有画面？** 源码入口没有编译后的 `main.js`，请使用编辑器构建 / 启动命令。
- **Shader 报错但画面仍在播放？** 这是保留最后有效程序的设计，查看右侧编译日志并修正源码。
- **草稿异常导致启动报错？** 编辑器会先准备默认回退画面，再尝试草稿；可用“恢复当前预设”覆盖错误草稿。
- **画面卡顿？** 降低 ITER / DETAIL、缩小窗口，或暂停绘制；预览负载取决于 Shader 本身。
