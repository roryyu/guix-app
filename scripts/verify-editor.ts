import { mkdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { buildApp, root } from './macos'

// --app 可验证 DMG 挂载后的应用；默认重新构建，避免测试陈旧产物。
const option = process.argv.find((arg) => arg.startsWith('--app='))
const app = option ? resolve(option.slice(6)) : await buildApp('editor')
const artifacts = join(root, 'artifacts')
await mkdir(artifacts, { recursive: true })
const result = await Bun.build({ entrypoints: [join(root, 'tests/editor-smoke.ts')],
  target: 'browser', format: 'iife' })
if (!result.success || !result.outputs[0]) throw new AggregateError(result.logs, '冒烟测试构建失败')
const script = join(artifacts, 'editor-smoke.js')
await Bun.write(script, `${await result.outputs[0].text()}\nreturn await window.editorSmoke();`)
const small = process.argv.includes('--small-window')
const screenshot = join(artifacts, small ? 'editor-webkit-small.png' : 'editor-webkit.png')
const child = Bun.spawn([join(app, 'Contents/MacOS/glsl-studio'), '--smoke', script, '--snapshot', screenshot,
  ...(small ? ['--small-window'] : [])], {
  cwd: root, stdout: 'pipe', stderr: 'pipe',
})
const timeout = setTimeout(() => child.kill(), 75_000)
try {
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  console.log(stdout)
  if (code !== 0 || !stdout.includes('WKWEBVIEW_SMOKE_OK')) throw new Error(`WKWebView 冒烟验证失败 (${code})：\n${stderr}`)
  if ((await stat(screenshot)).size < 1000) throw new Error('WKWebView 截图无效')
  console.log('真实 WKWebView 编译、GPU 像素、交互、上下文恢复与截图验证通过。')
} finally { clearTimeout(timeout); child.kill() }
