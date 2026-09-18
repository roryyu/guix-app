const UNIFORMS = [
  ['vec3', 'iResolution'], ['float', 'iTime'], ['float', 'iTimeDelta'],
  ['int', 'iFrame'], ['float', 'iFrameRate'], ['vec4', 'iMouse'],
  ['vec4', 'iDate'], ['float', 'iSampleRate'],
  ['sampler2D', 'iChannel0'], ['sampler2D', 'iChannel1'],
  ['sampler2D', 'iChannel2'], ['sampler2D', 'iChannel3'],
  ['vec3', 'iChannelResolution[4]'], ['float', 'iChannelTime[4]'],
  ['float', 'u_scale'], ['int', 'u_iterations'], ['int', 'u_detail'],
  ['vec2', 'u_resolution'], ['float', 'u_time'], ['vec2', 'u_mouse'], ['float', 'u_preset'],
] as const

// 保留注释占用的换行，便于编译日志对应用户代码行号。
export function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (part) => part.replace(/[^\n]/g, ' '))
}

export function buildFragmentSource(input: string, derivatives = true, precision = 'highp') {
  let code = input.replace(/^\uFEFF/, '')
  const warnings: string[] = []
  let visible = withoutComments(code)
  if (/^\s*#version\s+(?!100\b)\d+/m.test(visible)) {
    throw new Error('当前使用 WebGL 1 / GLSL ES 1.0，不支持 #version 300 es。')
  }

  const aliases: Record<string, string> = { frac: 'fract', lerp: 'mix', ddx: 'dFdx', ddy: 'dFdy', saturate: '_gpuix_saturate' }
  const changed = new Set<string>()
  // 只替换非注释中的调用名，保留参数括号结构，支持 saturate(mix(...))。
  code = code.split(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g).map((part) => {
    if (part.startsWith('//') || part.startsWith('/*')) return part
    return part.replace(/\b(frac|lerp|ddx|ddy|saturate)\s*(?=\()/g, (name) => {
      const original = name.trim()
      changed.add(original)
      return aliases[original] ?? original
    })
  }).join('')
  for (const name of changed) warnings.push(`${name} → ${aliases[name]}`)

  visible = withoutComments(code)
  const extensions: string[] = []
  const originalLines = code.split('\n')
  visible.split('\n').forEach((line, index) => {
    if (/^\s*#extension\b/.test(line)) {
      extensions.push(line.trim())
      originalLines[index] = ''
    } else if (/^\s*#version\b/.test(line)) originalLines[index] = ''
  })
  code = originalLines.join('\n')
  const usesDerivatives = /\b(dFdx|dFdy|fwidth)\s*\(/.test(visible)
  if (usesDerivatives && !derivatives) throw new Error('当前 GPU 不支持 OES_standard_derivatives。')
  if (usesDerivatives && !extensions.some((line) => line.includes('GL_OES_standard_derivatives'))) {
    extensions.push('#extension GL_OES_standard_derivatives : enable')
  }

  const declared = new Set<string>()
  for (const match of visible.matchAll(/\buniform\s+(?:(?:highp|mediump|lowp)\s+)?\w+\s+([^;]+);/g)) {
    for (const declaration of (match[1] ?? '').split(',')) {
      const name = /^\s*(\w+)/.exec(declaration)?.[1]
      if (name) declared.add(name)
    }
  }
  const header = ['#version 100', ...extensions]
  const userPrecision = /\bprecision\s+(highp|mediump|lowp)\s+float\s*;/.exec(visible)?.[1]
  header.push(`precision ${userPrecision ?? precision} float;`)
  for (const [type, name] of UNIFORMS) {
    if (!declared.has(name.replace(/\[.*$/, ''))) header.push(`uniform ${type} ${name};`)
  }
  if (changed.has('saturate')) {
    for (const type of ['float', 'vec2', 'vec3', 'vec4']) {
      header.push(`${type} _gpuix_saturate(${type} v) { return clamp(v, 0.0, 1.0); }`)
    }
  }
  const hasMain = /\bvoid\s+main\s*\(/.test(visible)
  const hasMainImage = /\bvoid\s+mainImage\s*\(/.test(visible)
  if (!hasMain && !hasMainImage) throw new Error('缺少 void main() 或 void mainImage(out vec4, vec2)。')
  const footer = hasMain ? '' : '\n#line 100000\nvoid main() { vec4 color = vec4(0.0); mainImage(color, gl_FragCoord.xy); gl_FragColor = color; }'
  return { source: `${header.join('\n')}\n#line 1\n${code}${footer}`, warnings }
}
