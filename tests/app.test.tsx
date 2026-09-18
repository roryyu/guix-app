import { afterEach, describe, expect, it } from 'vitest'
import { connectTest, type App as AutomationApp } from '@gpuix/react/automation'
import { createTestRoot, hasNativeTestRenderer, type TestRoot } from '@gpuix/react/testing'
import { App } from '../src/App'
import { chartValues } from '../src/model'

// Linux 暂无 GPU 测试渲染器，明确跳过；不以 DOM mock 冒充原生绘制。
const nativeSuite = hasNativeTestRenderer && process.platform !== 'linux' ? describe : describe.skip

nativeSuite('真实 GPUI 图形交互', () => {
  let testRoot: TestRoot | undefined
  let app: AutomationApp | undefined

  async function mount(width = 1180, height = 820) {
    testRoot = createTestRoot({ width, height })
    testRoot.render(<App />)
    app = await connectTest(testRoot.renderer)
    await app.clock.pause()
    return { app, renderer: testRoot.renderer }
  }

  afterEach(async () => {
    try { testRoot?.unmount() } finally { await app?.close() }
    app = undefined
    testRoot = undefined
  })

  it('首屏确实绘制中文、几何图元、渐变和代码', async () => {
    const { app, renderer } = await mount()
    expect(renderer.getPaintedText()).toContain('图形实验室')
    expect(await app.getByTestId('scene-title').textContent()).toBe('几何构成')
    expect(await app.getByTestId('shape-11').count()).toBe(1)
    expect((await app.getByTestId('shape-0').bounds()).width).toBeGreaterThan(0)
    expect(renderer.findByTestId('shape-0')?.style.background).toMatchObject({ type: 'linear-gradient' })
    expect(renderer.getPaintedText().some((line) => line.includes('motion.div'))).toBe(true)
  })

  it('数量、选择、配色、网格、键盘操作和重置形成闭环', async () => {
    const { app, renderer } = await mount()
    await app.getByTestId('shape-0').click()
    expect(await app.getByTestId('selection').textContent()).toContain('图元 1')
    await app.getByTestId('count-up').click()
    expect(await app.getByTestId('count').textContent()).toBe('15')
    await app.getByTestId('palette-violet').click()
    expect(await app.getByTestId('readout').textContent()).toContain('palette=violet')
    await app.getByTestId('toggle-grid').press('enter')
    expect(await app.getByTestId('stage-grid').count()).toBe(0)
    await app.getByTestId('toggle-motion').click()
    expect(await app.getByTestId('readout').textContent()).toContain('motion=false')
    await app.getByTestId('reset').click()
    expect(await app.getByTestId('count').textContent()).toBe('12')
    expect(renderer.findByTestId('shape-14')).toBeUndefined()
    expect(await app.getByTestId('selection').textContent()).toBe('点击图元查看属性')
    expect(await app.getByTestId('stage-grid').count()).toBe(1)
  })

  it('原生动画在中间帧插值并抵达布局终点', async () => {
    const { app } = await mount()
    const before = await app.getByTestId('shape-0').bounds()
    await app.getByTestId('transform').click()
    await app.clock.fastForward(325)
    const middle = await app.getByTestId('shape-0').bounds()
    await app.clock.fastForward(500)
    const after = await app.getByTestId('shape-0').bounds()
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(30)
    expect(middle.x).toBeGreaterThan(Math.min(before.x, after.x))
    expect(middle.x).toBeLessThan(Math.max(before.x, after.x))
    expect(await app.getByTestId('readout').textContent()).toContain('layout=grid')
  })

  it('图表换组更新实际高度，点击可读取对应数据', async () => {
    const { app } = await mount()
    await app.getByTestId('scene-chart').click()
    const before = await app.getByTestId('bar-0').bounds()
    await app.getByTestId('transform').click()
    await app.clock.fastForward(700)
    const after = await app.getByTestId('bar-0').bounds()
    expect(after.height).not.toBe(before.height)
    await app.getByTestId('bar-0').click()
    expect(await app.getByTestId('selection').textContent()).toBe(`样本 1 · 数值 ${chartValues(12, 1)[0]}`)
  })

  it('SVG 使用真实 source 与颜色，支持切换图案', async () => {
    const { app, renderer } = await mount()
    await app.getByTestId('scene-vector').click()
    const before = renderer.findByTestId('vector-art')?.customProps?.source
    expect(before).toContain('<rect ')
    await app.getByTestId('transform').click()
    expect(renderer.findByTestId('vector-art')?.customProps?.source).toContain('<circle ')
    await app.getByTestId('palette-coral').click()
    expect(renderer.findByTestId('vector-art')?.style.color).toBe('#FFCE99')
    expect((await app.getByTestId('vector-art').bounds()).width).toBe(240)
  })

  it('最小窗口下绘图区与主要控制仍在可见范围', async () => {
    const { app } = await mount(1060, 760)
    for (const id of ['stage', 'transform', 'reset']) {
      const bounds = await app.getByTestId(id).bounds()
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(1060)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(760)
    }
  })
})
