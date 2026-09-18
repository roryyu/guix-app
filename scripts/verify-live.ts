import assert from 'node:assert/strict'
import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { launch } from '@gpuix/react/automation'

// 通过应用自己的自动化协议测试，不控制系统鼠标，也不抢占用户键盘焦点。
const cwd = path.resolve(import.meta.dir, '..')
const packaged = process.argv.find((arg) => arg.startsWith('--app='))?.slice(6)
const binary = process.argv.includes('--binary') || Boolean(packaged)
const artifacts = path.join(cwd, 'artifacts')
mkdirSync(artifacts, { recursive: true })
const app = await launch({
  command: packaged ? path.join(path.resolve(packaged), 'Contents/MacOS/guix-app')
    : binary ? path.join(cwd, 'dist', process.platform === 'win32' ? 'guix-app.exe' : 'guix-app') : 'bun',
  args: binary ? [] : ['src/main.tsx'],
  cwd,
  env: { GPUIX_BACKGROUND: '1' },
})

async function screenshot(name: string) {
  const target = path.join(artifacts, `${packaged ? 'packaged' : binary ? 'binary' : 'live'}-${name}.png`)
  await app.screenshot({ path: target })
  assert.ok(statSync(target).size > 1000, '截图必须包含有效的 GPU 绘制结果')
  console.log(`截图：${target}`)
}

try {
  await app.getByTestId('shape-0').waitFor({ timeoutMs: 60_000 })
  await app.clock.pause()
  assert.equal(await app.getByTestId('scene-title').textContent(), '几何构成')
  await screenshot('geometry')

  await app.getByTestId('transform').click()
  await app.clock.fastForward(800)
  assert.match(await app.getByTestId('readout').textContent(), /layout=grid/)
  await app.getByTestId('shape-0').click()
  assert.match(await app.getByTestId('selection').textContent(), /图元 1/)
  await screenshot('grid')

  await app.getByTestId('scene-chart').click()
  await app.getByTestId('transform').click()
  await app.clock.fastForward(800)
  assert.match(await app.getByTestId('readout').textContent(), /seed=1/)
  await app.getByTestId('bar-0').click()
  assert.match(await app.getByTestId('selection').textContent(), /数值 47/)
  await screenshot('chart')

  await app.getByTestId('scene-vector').click()
  await app.getByTestId('palette-violet').click()
  assert.equal(await app.getByTestId('vector-art').count(), 1)
  assert.match(await app.getByTestId('readout').textContent(), /palette=violet/)
  await screenshot('vector')

  await app.getByTestId('reset').click()
  assert.equal(await app.getByTestId('count').textContent(), '12')
  console.log(`${packaged ? '打包应用' : binary ? '独立二进制' : '源码启动'}：原生窗口、三场景交互与 GPU 截图验证通过。`)
} finally {
  await app.close()
}
