import { useReducer } from 'react'
import { useWindowSize } from '@gpuix/react'
import { Button, Field, Toggle } from './components/controls'
import { SceneStage, sceneCode } from './components/scenes'
import { chartValues, initialState, labReducer, MAX_COUNT, MIN_COUNT, scenes } from './model'
import { colors, column, palettes, panel, row, textStyle, type PaletteId } from './theme'

const backend = process.platform === 'darwin' ? 'Metal' : process.platform === 'win32' ? 'DirectX' : 'Vulkan'

export function App() {
  const [state, dispatch] = useReducer(labReducer, initialState)
  const windowSize = useWindowSize()
  // 与三栏固定宽度、间距和边框对齐；大窗口限制绘图区宽度以保持可读性。
  const stageWidth = Math.max(420, Math.min(780, windowSize.width - 508))
  const scene = scenes.find((entry) => entry.id === state.scene) ?? scenes[0]
  const selectedValue = state.selected === null ? null : chartValues(state.count, state.seed)[state.selected]
  const selection = state.selected === null ? '点击图元查看属性' : state.scene === 'chart'
    ? `样本 ${state.selected + 1} · 数值 ${selectedValue}` : `图元 ${state.selected + 1} · 原生矩形 / 圆角`

  return (
    <div testId="app" style={{ ...column, width: '100%', height: '100%', backgroundColor: colors.background }}>
      <div style={{ ...row, height: 76, paddingLeft: 26, paddingRight: 26, flexShrink: 0,
        justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border }}>
        <div style={{ ...row, gap: 13 }}>
          <div style={{ ...row, justifyContent: 'center', width: 33, height: 33,
            backgroundColor: colors.accent, borderRadius: 9 }}>
            <text style={{ ...textStyle(20, colors.ink), fontWeight: 700 }}>g</text>
          </div>
          <div style={{ ...column, gap: 2 }}>
            <text style={{ ...textStyle(18), fontWeight: 600 }}>图形实验室</text>
            <text style={textStyle(10, colors.muted)}>GPUIX / 原生渲染探索</text>
          </div>
        </div>
        <div style={{ ...row, gap: 18 }}>
          <text style={textStyle(11, colors.muted)}>{`${backend} · React 19 · GPUIX 0.9.0`}</text>
          <Button testId="reset" onClick={() => dispatch({ type: 'reset' })}>重置实验</Button>
        </div>
      </div>

      <div style={{ ...row, alignItems: 'stretch', flexGrow: 1, minHeight: 0 }}>
        <div style={{ ...column, width: 190, flexShrink: 0, padding: 18, gap: 10,
          backgroundColor: colors.sidebar, borderRightWidth: 1, borderColor: colors.border }}>
          <text style={{ ...textStyle(10, colors.faint), marginBottom: 12 }}>实验目录</text>
          {scenes.map((entry) => (
            <Button key={entry.id} testId={`scene-${entry.id}`} label={entry.title}
              onClick={() => dispatch({ type: 'scene', value: entry.id })}
              style={{ ...column, alignItems: 'flex-start', gap: 7, padding: 13,
                backgroundColor: state.scene === entry.id ? colors.elevated : colors.sidebar,
                borderColor: state.scene === entry.id ? colors.border : colors.sidebar }}>
              <text style={textStyle(10, state.scene === entry.id ? colors.accent : colors.faint)}>{entry.number}</text>
              <text style={textStyle(13)}>{entry.title}</text>
              <text style={textStyle(9, colors.muted)}>{entry.subtitle}</text>
            </Button>
          ))}
          <div style={{ flexGrow: 1 }} />
          <div style={{ ...column, gap: 9, paddingBottom: 10 }}>
            <text style={textStyle(11, colors.accent)}>渲染链路</text>
            {['React / JSX', '↓  commit 批量变更', 'Rust RetainedTree', '↓  布局与绘制', `GPUI / ${backend}`].map((line) =>
              <text key={line} style={textStyle(10, colors.muted)}>{line}</text>)}
          </div>
          <text style={textStyle(9, colors.faint)}>无 DOM · 无 Electron</text>
        </div>

        {/* 只有这一层纵向滚动；避免 GPUIX 不支持的嵌套纵向滚动。 */}
        <div style={{ ...column, flexGrow: 1, minWidth: 0, overflow: 'scroll', padding: 22, gap: 18 }}>
          <div style={{ ...row, justifyContent: 'space-between' }}>
            <div style={{ ...column, gap: 5 }}>
              <text testId="scene-title" style={{ ...textStyle(24), fontWeight: 600 }}>{scene.title}</text>
              <text style={textStyle(11, colors.muted)}>每一个像素，由原生 GPU 渲染管线绘制。</text>
            </div>
            <text style={textStyle(11, colors.accent)}>{`实验 ${scene.number} / 03`}</text>
          </div>
          <div style={{ ...row, alignItems: 'flex-start', gap: 18 }}>
            <div style={{ ...column, width: stageWidth + 2, flexShrink: 0, gap: 14 }}>
              <div style={{ ...panel, overflow: 'hidden' }}>
                <div style={{ ...row, padding: 13, justifyContent: 'space-between' }}>
                  <text style={textStyle(11)}>实时绘图区</text>
                  <text style={textStyle(10, colors.muted)}>{`${Math.round(stageWidth)} × 340`}</text>
                </div>
                <SceneStage state={state} width={stageWidth}
                  onSelect={(value) => dispatch({ type: 'select', value })} />
                <div style={{ padding: 12 }}>
                  <text testId="selection" style={textStyle(11, colors.muted)}>
                    {state.scene === 'vector' ? 'SVG 作为单色蒙版渲染，配色由 style.color 控制' : selection}
                  </text>
                </div>
              </div>
              <div style={{ ...panel, padding: 14, gap: 10 }}>
                <div style={{ ...row, justifyContent: 'space-between' }}>
                  <text style={textStyle(11)}>核心 API 片段</text>
                  <text style={textStyle(9, colors.faint)}>TypeScript / JSX · 示意片段</text>
                </div>
                <code testId="code-preview" code={sceneCode(state)} language="tsx"
                  style={{ fontFamily: 'Menlo', fontSize: 11, color: colors.text }} />
              </div>
            </div>

            <div style={{ ...panel, width: 230, flexShrink: 0, padding: 17, gap: 21 }}>
              <text style={{ ...textStyle(14), fontWeight: 600 }}>实验参数</text>
              <Field title="配色方案">
                <div style={{ ...row, gap: 7 }}>
                  {(Object.keys(palettes) as PaletteId[]).map((id) => (
                    <Button key={id} testId={`palette-${id}`} label={palettes[id].name}
                      onClick={() => dispatch({ type: 'palette', value: id })}
                      style={{ flexGrow: 1, height: 30, padding: 3,
                        backgroundColor: palettes[id].from,
                        borderColor: state.palette === id ? colors.text : colors.border,
                        borderWidth: state.palette === id ? 2 : 1 }}>
                      <text style={textStyle(10, colors.ink)}>{palettes[id].name}</text>
                    </Button>
                  ))}
                </div>
              </Field>
              {state.scene !== 'vector' && (
                <Field title={`图元数量 / ${MIN_COUNT}–${MAX_COUNT}`}>
                  <div style={{ ...row, justifyContent: 'space-between' }}>
                    <Button testId="count-down" label="减少图元" disabled={state.count === MIN_COUNT}
                      onClick={() => dispatch({ type: 'count', delta: -3 })}>−</Button>
                    <text testId="count" style={textStyle(20)}>{String(state.count)}</text>
                    <Button testId="count-up" label="增加图元" disabled={state.count === MAX_COUNT}
                      onClick={() => dispatch({ type: 'count', delta: 3 })}>+</Button>
                  </div>
                </Field>
              )}
              <Field title="绘制选项">
                <Toggle testId="toggle-grid" label="参考网格" enabled={state.grid}
                  onClick={() => dispatch({ type: 'grid' })} />
                {state.scene !== 'vector' && <Toggle testId="toggle-motion" label="原生过渡" enabled={state.motion}
                  onClick={() => dispatch({ type: 'motion' })} />}
              </Field>
              <Button testId="transform" active onClick={() => dispatch({ type: state.scene === 'geometry' ? 'layout' : 'refresh' })}>
                {state.scene === 'geometry' ? (state.layout === 'orbit' ? '切换为矩阵布局' : '切换为环形布局')
                  : state.scene === 'chart' ? '生成下一组数据' : '切换矢量图案'}
              </Button>
              <text style={textStyle(10, colors.muted)}>
                {state.scene === 'vector'
                  ? 'source 直接嵌入 SVG，无需网络或外部资源。彩色 SVG 应使用 img。'
                  : 'React 只提交目标值；Rust 插值并请求绘制帧，不需要 JS 逐帧更新状态。'}
              </text>
              <div style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12 }}>
                <text testId="readout" style={textStyle(9, colors.faint)}>
                  {`scene=${state.scene}\nlayout=${state.layout}\ncount=${state.count}\npalette=${state.palette}\ngrid=${state.grid}\nmotion=${state.motion}\nseed=${state.seed}`.replaceAll('\n', ' · ')}
                </text>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ ...row, flexShrink: 0, height: 30, paddingLeft: 20, paddingRight: 20,
        justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border }}>
        <text style={textStyle(9, colors.muted)}>交互：点击选择 · Tab 聚焦 · Enter / Space 操作</text>
        <text style={textStyle(9, colors.faint)}>GPUIX 0.9.0 / 本地原生示例</text>
      </div>
    </div>
  )
}
