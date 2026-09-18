import { chmod, copyFile, cp, mkdir, mkdtemp, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import manifest from '../package.json'

export const root = resolve(import.meta.dir, '..')
export const output = join(root, 'dist', 'macos')
export type Target = 'editor' | 'gpuix'
const products = {
  editor: { name: 'GLSL Studio', executable: 'glsl-studio', id: 'local.guix.glsl-studio' },
  gpuix: { name: 'GPUIX Lab', executable: 'guix-app', id: 'local.guix.gpuix-lab' },
} as const

export async function run(command: string[], env: Record<string, string | undefined> = {}) {
  const child = Bun.spawn(command, { cwd: root, env: { ...process.env, ...env }, stdout: 'inherit', stderr: 'inherit' })
  const code = await child.exited
  if (code !== 0) throw new Error(`命令失败 (${code})：${command.join(' ')}`)
}

export async function buildWeb() {
  const web = join(root, 'dist', 'editor-web')
  await mkdir(web, { recursive: true })
  const result = await Bun.build({ entrypoints: [join(root, 'shader-editor/main.ts')],
    outdir: web, naming: 'main.js', target: 'browser', format: 'iife', minify: false })
  if (!result.success) throw new AggregateError(result.logs, '编辑器前端构建失败')
  await Promise.all(['index.html', 'style.css'].map((file) => copyFile(join(root, 'shader-editor', file), join(web, file))))
  return web
}

export function appPath(target: Target) { return join(output, `${products[target].name}.app`) }

export async function buildApp(target: Target) {
  if (process.platform !== 'darwin') throw new Error('App / DMG 打包仅支持 macOS，需安装 Xcode Command Line Tools。')
  if (target === 'gpuix' && process.arch !== 'arm64') throw new Error('当前 GPUIX npm 包仅提供 Apple Silicon 的 macOS 原生模块。')
  const product = products[target]
  const app = appPath(target)
  const contents = join(app, 'Contents')
  const executable = join(contents, 'MacOS', product.executable)
  const resources = join(contents, 'Resources')
  await mkdir(join(contents, 'MacOS'), { recursive: true })
  await mkdir(resources, { recursive: true })
  if (target === 'editor') {
    const web = await buildWeb()
    await cp(web, join(resources, 'web'), { recursive: true })
    const cache = join(root, 'dist', 'swift-module-cache')
    await mkdir(cache, { recursive: true })
    await run(['xcrun', 'swiftc', '-O', '-module-cache-path', cache,
      '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos13.0`,
      '-framework', 'AppKit', '-framework', 'WebKit', join(root, 'desktop/main.swift'), '-o', executable])
  } else {
    await run([process.execPath, 'build', '--compile', 'src/main.tsx', '--outfile', executable])
  }
  await chmod(executable, 0o755)
  await Bun.write(join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>${product.name}</string>
  <key>CFBundleDisplayName</key><string>${product.name}</string>
  <key>CFBundleIdentifier</key><string>${product.id}</string>
  <key>CFBundleExecutable</key><string>${product.executable}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${manifest.version}</string>
  <key>CFBundleVersion</key><string>${manifest.version}</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
</dict></plist>
`)
  await run(['plutil', '-lint', join(contents, 'Info.plist')])
  // 本地 ad-hoc 签名不等同于 Developer ID 签名，也不代表经过 Apple 公证。
  await run(['codesign', '--force', '--sign', '-', app])
  await run(['codesign', '--verify', '--deep', '--strict', '--verbose=2', app])
  console.log(`应用已生成：${app}`)
  return app
}

export async function buildDmg(target: Target, app: string) {
  const product = products[target]
  // 每次使用独立暂存目录，不清空用户目录；所有构建中间文件均留在 dist 内。
  const stage = await mkdtemp(join(output, '.dmg-stage-'))
  await cp(app, join(stage, `${product.name}.app`), { recursive: true })
  await symlink('/Applications', join(stage, 'Applications'))
  const dmg = join(output, `${product.executable}-${manifest.version}-${process.arch}.dmg`)
  await run(['hdiutil', 'create', '-volname', product.name, '-srcfolder', stage, '-format', 'UDZO', '-fs', 'HFS+', '-ov', dmg])
  await run(['hdiutil', 'verify', dmg])
  console.log(`DMG 已生成：${dmg}\n包含应用和 Applications 拖放入口；当前仅本地签名，未公证。`)
  return dmg
}
