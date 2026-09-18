import { describe, expect, it } from 'vitest'
import { chartValues, initialState, labReducer, MAX_COUNT, MIN_COUNT, shapeLayout, STAGE_HEIGHT, vectorSource } from '../src/model'

// 纯逻辑测试不依赖原生窗口或 GPU。
describe('实验状态与几何计算', () => {
  it('图元数量限制在支持范围，缩减数量后清除无效选中项', () => {
    expect(labReducer(initialState, { type: 'count', delta: 999 }).count).toBe(MAX_COUNT)
    expect(labReducer(initialState, { type: 'count', delta: -999 }).count).toBe(MIN_COUNT)
    const selected = labReducer(initialState, { type: 'select', value: 11 })
    expect(labReducer(selected, { type: 'count', delta: -3 }).selected).toBeNull()
    expect(labReducer(initialState, { type: 'select', value: 99 })).toBe(initialState)
  })

  it('布局可往返切换，重置恢复全部参数', () => {
    const changed = labReducer(initialState, { type: 'layout' })
    expect(changed.layout).toBe('grid')
    expect(labReducer(changed, { type: 'layout' }).layout).toBe('orbit')
    expect(labReducer({ ...changed, count: 24, seed: 9 }, { type: 'reset' })).toEqual(initialState)
  })

  it.each(['orbit', 'grid'] as const)('%s 布局在最小画布内不越界', (layout) => {
    for (const count of [6, 9, 12, 15, 18, 21, 24]) {
      const shapes = shapeLayout(count, layout, 420)
      expect(shapes).toHaveLength(count)
      for (const shape of shapes) {
        expect(shape.x).toBeGreaterThanOrEqual(0)
        expect(shape.y).toBeGreaterThanOrEqual(0)
        expect(shape.x + shape.size).toBeLessThanOrEqual(420)
        expect(shape.y + shape.size).toBeLessThanOrEqual(STAGE_HEIGHT)
      }
    }
  })

  it('图表数据确定、范围有效且支持换组', () => {
    expect(chartValues(12, 0)).toEqual(chartValues(12, 0))
    expect(chartValues(12, 1)).not.toEqual(chartValues(12, 0))
    expect(chartValues(24, 10).every((value) => value >= 24 && value <= 100)).toBe(true)
  })

  it('SVG 包含九条路径并交替切换构型', () => {
    expect(vectorSource(0).match(/<rect /g)).toHaveLength(9)
    expect(vectorSource(1).match(/<circle /g)).toHaveLength(9)
    expect(vectorSource(0)).toBe(vectorSource(2))
  })
})
