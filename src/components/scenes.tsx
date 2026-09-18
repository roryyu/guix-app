import { motion, type LinearGradientBackground } from '@gpuix/react'
import { useMemo } from 'react'
import { chartValues, shapeLayout, STAGE_HEIGHT, vectorSource, type LabState } from '../model'
import { colors, column, palettes, row, textStyle } from '../theme'

interface SceneProps {
  state: LabState
  width: number
  onSelect: (index: number) => void
}

function gradient(state: LabState, angle = 135): LinearGradientBackground {
  const palette = palettes[state.palette]
  return { type: 'linear-gradient', angle, colorSpace: 'oklab', stops: [
    { color: palette.from, position: 0 }, { color: palette.to, position: 1 },
  ] }
}

function Grid({ width }: { width: number }) {
  return (
    <div testId="stage-grid" style={{ position: 'absolute', width, height: STAGE_HEIGHT, pointerEvents: 'none' }}>
      {Array.from({ length: Math.ceil(width / 28) }, (_, index) =>
        <div key={`x${index}`} style={{ position: 'absolute', left: index * 28, top: 0,
          width: 1, height: STAGE_HEIGHT, backgroundColor: colors.grid }} />)}
      {Array.from({ length: 13 }, (_, index) =>
        <div key={`y${index}`} style={{ position: 'absolute', top: index * 28, left: 0,
          width, height: 1, backgroundColor: colors.grid }} />)}
    </div>
  )
}

function Geometry({ state, width, onSelect }: SceneProps) {
  const shapes = shapeLayout(state.count, state.layout, width)
  return (
    <div style={{ position: 'relative', width, height: STAGE_HEIGHT }}>
      {state.layout === 'orbit' && (
        <div style={{ ...column, position: 'absolute', left: width / 2 - 60, top: 137,
          width: 120, alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
          <text style={{ ...textStyle(27, palettes[state.palette].from), fontWeight: 600 }}>GPUIX</text>
          <text style={textStyle(10, colors.muted)}>原生 GPU 图元</text>
        </div>
      )}
      {shapes.map(({ x, y, size }, index) => (
        <motion.div key={index} initial={false}
          animate={{ left: x, top: y, width: size, height: size }}
          transition={{ duration: state.motion ? 0.65 : 0, ease: 'easeInOut' }}
          style={{ position: 'absolute' }}>
          <div testId={`shape-${index}`} role="button" aria-label={`图元 ${index + 1}`} tabIndex={0}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === 'enter' || event.key === 'space') onSelect(index)
            }}
            style={{ width: '100%', height: '100%', borderRadius: index % 3 === 0 ? size / 2 : 9,
              background: gradient(state, 90 + index * 20), borderWidth: state.selected === index ? 3 : 1,
              borderColor: state.selected === index ? colors.text : palettes[state.palette].to,
              cursor: 'pointer', hover: { opacity: 0.7 } }} />
        </motion.div>
      ))}
    </div>
  )
}

function Chart({ state, width, onSelect }: SceneProps) {
  const values = chartValues(state.count, state.seed)
  const slot = (width - 64) / values.length
  return (
    <div style={{ position: 'relative', width, height: STAGE_HEIGHT }}>
      <div style={{ position: 'absolute', left: 24, top: 18 }}>
        <text style={textStyle(11, colors.muted)}>确定性示例数据 / 非性能指标</text>
      </div>
      {values.map((value, index) => (
        <motion.div key={index} initial={false} animate={{ height: value * 2.1 }}
          transition={{ duration: state.motion ? 0.6 : 0, ease: 'easeOut' }}
          style={{ position: 'absolute', bottom: 46, left: 32 + index * slot, width: Math.max(5, slot - 7) }}>
          <div testId={`bar-${index}`} role="button" aria-label={`数据 ${index + 1}：${value}`} tabIndex={0}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => {
              if (event.key === 'enter' || event.key === 'space') onSelect(index)
            }}
            style={{ width: '100%', height: '100%', borderRadius: 4,
              background: gradient(state, 0), cursor: 'pointer', hover: { opacity: 0.65 },
              borderWidth: state.selected === index ? 2 : 0, borderColor: colors.text }} />
        </motion.div>
      ))}
      <div style={{ ...row, position: 'absolute', bottom: 16, left: 32, right: 32,
        justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.faint, paddingTop: 8 }}>
        <text style={textStyle(10, colors.muted)}>01</text>
        <text style={textStyle(10, colors.muted)}>{`${state.count} 个样本 · 点击柱形查看数值`}</text>
        <text style={textStyle(10, colors.muted)}>{String(state.count)}</text>
      </div>
    </div>
  )
}

function Vector({ state, width }: SceneProps) {
  // <svg> 是单色蒙版，必须设置 style.color；source 内的颜色不作为彩色图像保留。
  const source = useMemo(() => vectorSource(state.seed), [state.seed])
  return (
    <div style={{ ...column, width, height: STAGE_HEIGHT, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
      <svg testId="vector-art" source={source} style={{ width: 240, height: 240, color: palettes[state.palette].from }} />
      <text style={textStyle(11, colors.muted)}>9 条路径 · 单色 SVG · 原生着色</text>
    </div>
  )
}

export function SceneStage(props: SceneProps) {
  return (
    <div testId="stage" style={{ position: 'relative', width: props.width, height: STAGE_HEIGHT,
      backgroundColor: colors.background, overflow: 'hidden', flexShrink: 0 }}>
      {props.state.grid && <Grid width={props.width} />}
      {props.state.scene === 'geometry' && <Geometry {...props} />}
      {props.state.scene === 'chart' && <Chart {...props} />}
      {props.state.scene === 'vector' && <Vector {...props} />}
    </div>
  )
}

export function sceneCode(state: LabState): string {
  if (state.scene === 'geometry') return `<motion.div\n  animate={{ left: x, top: y, borderRadius: 9 }}\n  transition={{ duration: ${state.motion ? '0.65' : '0'}, ease: 'easeInOut' }}\n  style={{ background: twoStopGradient }}\n/>`
  if (state.scene === 'chart') return `<motion.div\n  animate={{ height: value * 2.1 }}\n  transition={{ duration: ${state.motion ? '0.6' : '0'} }}\n  style={{ position: 'absolute', bottom: 46 }}\n/>`
  return `<svg\n  source={vectorSource(seed)}\n  style={{ width: 240, height: 240,\n    color: '${palettes[state.palette].from}' }}\n/>`
}
