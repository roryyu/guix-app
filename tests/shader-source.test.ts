import { describe, expect, it } from 'vitest'
import { buildFragmentSource, withoutComments } from '../shader-editor/source'
import { PRESETS } from '../shader-editor/presets'

const image = 'void mainImage(out vec4 c, vec2 p) { c = vec4(1.0); }'
describe('GLSL 源码兼容处理', () => {
  it('包装 mainImage 并保留用户行号', () => {
    const { source } = buildFragmentSource(image)
    expect(source).toContain('uniform vec3 iResolution;')
    expect(source).toContain(`#line 1\n${image}`)
    expect(source).toContain('mainImage(color, gl_FragCoord.xy)')
  })
  it('已有 main 时不额外包装', () => {
    const { source } = buildFragmentSource('void main() { gl_FragColor = vec4(1.0); }')
    expect(source.match(/void main\(/g)).toHaveLength(1)
  })
  it('注释不参与入口判断，换行不变', () => {
    expect(() => buildFragmentSource('// void main() {}\n/* void mainImage() {} */')).toThrow('缺少')
    expect(withoutComments('/* a\nb */\nx// c\ny').split('\n')).toHaveLength(4)
  })
  it('去重已有带精度和数组的 uniform', () => {
    const { source } = buildFragmentSource(`uniform highp float iTime, iTimeDelta;
uniform vec3 iChannelResolution[4];
${image}`)
    expect(source).not.toContain('uniform float iTime;')
    expect(source).not.toContain('uniform float iTimeDelta;')
    expect(source.match(/uniform vec3 iChannelResolution\[4\];/g)).toHaveLength(1)
  })
  it('默认精度在所有注入声明之前，尊重用户精度', () => {
    const { source } = buildFragmentSource(`precision mediump float;\n${image}`)
    expect(source.indexOf('precision mediump float;')).toBeLessThan(source.indexOf('uniform vec3'))
  })
  it('将版本与扩展放在头部，拒绝 GLSL 300 es', () => {
    const { source } = buildFragmentSource(`#version 100\n#extension GL_OES_standard_derivatives : enable\n${image}`)
    expect(source.startsWith('#version 100\n#extension GL_OES_standard_derivatives : enable\nprecision')).toBe(true)
    expect(source.match(/#version/g)).toHaveLength(1)
    expect(() => buildFragmentSource(`#version 300 es\n${image}`)).toThrow('WebGL 1')
  })
  it('嵌套 saturate 与 frac/lerp 替换不破坏括号或注释', () => {
    const { source, warnings } = buildFragmentSource(`// frac(1.0)\nvoid main() { gl_FragColor = saturate(vec4(lerp(frac(0.5), 2.0, 0.5))); }`)
    expect(source).toContain('_gpuix_saturate(vec4(mix(fract(0.5), 2.0, 0.5)))')
    expect(source).toContain('// frac(1.0)')
    expect(source).toContain('vec4 _gpuix_saturate(vec4 v)')
    expect(warnings).toHaveLength(3)
  })
  it('导数扩展按需启用并检查 GPU 支持', () => {
    const code = 'void main() { gl_FragColor = vec4(ddx(gl_FragCoord.x)); }'
    expect(buildFragmentSource(code).source).toContain('#extension GL_OES_standard_derivatives : enable')
    expect(buildFragmentSource(code).source).toContain('dFdx(gl_FragCoord.x)')
    expect(() => buildFragmentSource(code, false)).toThrow('OES_standard_derivatives')
    expect(buildFragmentSource(image, false).source).not.toContain('#extension')
  })
  it.each(Object.keys(PRESETS) as (keyof typeof PRESETS)[])('%s 预设可生成完整片元源码', (preset) => {
    expect(buildFragmentSource(PRESETS[preset]).source).toContain('void main()')
  })
})
