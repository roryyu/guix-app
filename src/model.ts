import type { PaletteId } from './theme'

export type SceneId = 'geometry' | 'chart' | 'vector'
export type Layout = 'orbit' | 'grid'
export const MIN_COUNT = 6
export const MAX_COUNT = 24
export const STAGE_HEIGHT = 340

export const scenes = [
  { id: 'geometry', number: '01', title: '几何构成', subtitle: '原生图元 · 渐变 · 动画' },
  { id: 'chart', number: '02', title: '数据节奏', subtitle: '布局驱动的 GPU 图表' },
  { id: 'vector', number: '03', title: '矢量纹理', subtitle: 'SVG 路径 · 原生着色' },
] as const

export interface LabState {
  scene: SceneId
  palette: PaletteId
  count: number
  layout: Layout
  grid: boolean
  motion: boolean
  selected: number | null
  seed: number
}

export const initialState: LabState = {
  scene: 'geometry', palette: 'lime', count: 12, layout: 'orbit',
  grid: true, motion: true, selected: null, seed: 0,
}

export type Action =
  | { type: 'scene'; value: SceneId }
  | { type: 'palette'; value: PaletteId }
  | { type: 'count'; delta: number }
  | { type: 'select'; value: number }
  | { type: 'layout' | 'grid' | 'motion' | 'refresh' | 'reset' }

export function labReducer(state: LabState, action: Action): LabState {
  switch (action.type) {
    case 'scene': return { ...state, scene: action.value, selected: null }
    case 'palette': return { ...state, palette: action.value }
    case 'count': {
      const count = Math.min(MAX_COUNT, Math.max(MIN_COUNT, state.count + action.delta))
      return { ...state, count, selected: state.selected !== null && state.selected >= count ? null : state.selected }
    }
    case 'select': return action.value >= 0 && action.value < state.count
      ? { ...state, selected: action.value } : state
    case 'layout': return { ...state, layout: state.layout === 'orbit' ? 'grid' : 'orbit' }
    case 'grid': return { ...state, grid: !state.grid }
    case 'motion': return { ...state, motion: !state.motion }
    case 'refresh': return { ...state, seed: state.seed + 1 }
    case 'reset': return { ...initialState }
  }
}

// 几何计算与渲染解耦；固定输入产生固定画面，方便测试和复现。
export function shapeLayout(count: number, layout: Layout, width: number) {
  return Array.from({ length: count }, (_, index) => {
    const size = count > 18 ? 30 : 42
    if (layout === 'grid') {
      const columns = 6
      const rows = Math.ceil(count / columns)
      return {
        x: (width - columns * 64) / 2 + (index % columns) * 64 + (64 - size) / 2,
        y: (STAGE_HEIGHT - rows * 64) / 2 + Math.floor(index / columns) * 64 + (64 - size) / 2,
        size,
      }
    }
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2
    return {
      x: width / 2 + Math.cos(angle) * Math.min(width * 0.32, 188) - size / 2,
      y: STAGE_HEIGHT / 2 + Math.sin(angle) * 116 - size / 2,
      size,
    }
  })
}

// 这是确定性的示例数据，不是 GPU 性能监测或真实业务指标。
export function chartValues(count: number, seed: number): number[] {
  return Array.from({ length: count }, (_, index) =>
    24 + ((index * 37 + seed * 23 + index * index * 7) % 77))
}

export function vectorSource(variant: number): string {
  const paths = Array.from({ length: 9 }, (_, index) => {
    const inset = 12 + index * 9
    return variant % 2 === 0
      ? `<rect x="${inset}" y="${inset}" width="${240 - inset * 2}" height="${240 - inset * 2}" rx="${12 + index * 3}"/>`
      : `<circle cx="120" cy="120" r="${108 - index * 10}"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g fill="none" stroke="#000" stroke-width="2">${paths}</g></svg>`
}
