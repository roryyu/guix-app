// 此函数由 Swift 外壳在真实 WKWebView 内执行，不使用模拟 WebGL。
export async function editorSmoke() {
  const passed: string[] = []
  Object.assign(window, { smokeProgress: passed })
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  function check(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message)
  }
  async function until(condition: () => boolean, message: string) {
    for (let i = 0; i < 100; i++) { if (condition()) return; await sleep(50) }
    throw new Error(message)
  }
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const click = (id: string) => get(id).click()
  await until(() => Boolean(window.shaderLab), `编辑器初始化失败：${get('console').textContent}`)
  const lab = window.shaderLab!
  const inspect = () => lab.inspect()
  const code = get<HTMLTextAreaElement>('code')
  const auto = get<HTMLInputElement>('auto')
  function edit(value: string) { code.value = value; code.dispatchEvent(new Event('input', { bubbles: true })) }
  function automatic(value: boolean) { auto.checked = value; auto.dispatchEvent(new Event('change', { bubbles: true })) }
  function compile(value: string) { edit(value); click('run'); check(!inspect().error, inspect().error) }
  function color(expected: number[]) {
    const state = inspect()
    check(state.ready && state.glError === 0, `GPU 状态错误：${JSON.stringify(state)}`)
    check(expected.every((v, i) => Math.abs(v - state.pixel[i]!) <= 2), `像素不符：${state.pixel}，预期 ${expected}`)
  }

  check(inspect().ready && !inspect().error, `默认 Shader 失败：${inspect().error}`)
  check(inspect().width > 100 && inspect().height > 100, '画布尺寸无效')
  passed.push('默认 NEBULA 编译与 GPU 初始化')
  click('play')
  await sleep(100)
  const paused = inspect()
  await sleep(200)
  check(inspect().time === paused.time && inspect().frame === paused.frame, '暂停后仍在推进时钟或帧数')
  automatic(false)
  const red = 'precision mediump float;\nvoid main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'
  compile(red)
  color([255, 0, 0, 255])
  passed.push('自定义 main、precision 与真实红色像素')

  const good = inspect().compileCount
  edit('void main() {\n  syntax_error;\n}')
  click('run')
  check(Boolean(inspect().error) && inspect().compileCount === good, '错误片元替换了有效程序')
  check(/2/.test(inspect().error), '编译错误未保留用户行号')
  color([255, 0, 0, 255])
  click('tab-vertex')
  const vertex = code.value
  edit('invalid vertex')
  click('run')
  check(inspect().error.includes('VERT'), '未报告顶点编译失败')
  color([255, 0, 0, 255])
  edit(vertex)
  click('tab-fragment')
  compile(red)
  edit('#version 300 es\nvoid main() {}')
  click('run')
  check(inspect().error.includes('WebGL 1'), '未拒绝不兼容的 GLSL 版本')
  color([255, 0, 0, 255])
  passed.push('顶点/片元错误回退、行号和版本边界')

  compile('void main() { gl_FragColor = saturate(vec4(lerp(frac(0.5), 2.0, 0.5))) + vec4(ddx(gl_FragCoord.x) * 0.0); }')
  color([255, 255, 255, 255])
  compile('uniform vec3 iResolution; uniform float iTime, iTimeDelta;\nvoid mainImage(out vec4 c, vec2 p) { c = vec4(p / iResolution.xy, 0.0, 1.0); }')
  color([128, 128, 0, 255])
  compile('void mainImage(out vec4 c, vec2 p) { c = texture2D(iChannel0, p/iResolution.xy) + vec4(iChannelTime[0] + iChannelResolution[0].x - 1.0); }')
  color([0, 0, 0, 255])
  passed.push('嵌套兼容函数、导数、uniform 去重和黑色通道纹理')

  for (const [id, value] of Object.entries({ speed: 1.8, scale: 32, iterations: 12, detail: 20 })) {
    const input = get<HTMLInputElement>(id)
    input.value = String(value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    check(inspect().params[id as keyof ReturnType<typeof inspect>['params']] === value, `${id} 参数未更新`)
  }
  compile('void main() { gl_FragColor = vec4(u_scale/60.0, float(u_iterations)/40.0, float(u_detail)/60.0, 1.0); }')
  color([136, 77, 85, 255])
  const canvas = get<HTMLCanvasElement>('gl')
  const rect = canvas.getBoundingClientRect()
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: rect.left + rect.width * 0.25, clientY: rect.top + rect.height * 0.25 }))
  compile('void main() { gl_FragColor = vec4(iMouse.xy/iResolution.xy, 0.0, 1.0); }')
  color([64, 191, 0, 255])
  passed.push('四参数控制与鼠标坐标 uniform 的 GPU 像素结果')

  compile(red)
  automatic(true)
  const beforeAuto = inspect().compileCount
  edit(red + '\n// 自动编译')
  check(inspect().compileCount === beforeAuto, '自动编译没有防抖')
  await until(() => inspect().compileCount > beforeAuto, '自动编译未发生')
  const beforeCancel = inspect().compileCount
  edit(red + '\n// 取消排队')
  automatic(false)
  await sleep(800)
  check(inspect().compileCount === beforeCancel, '关闭自动编译未取消排队任务')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }))
  check(inspect().compileCount === beforeCancel + 1, 'Ctrl+Enter 未编译')
  code.selectionStart = code.selectionEnd = 0
  code.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  check(code.value.startsWith('  '), 'Tab 缩进失效')
  const editor = document.querySelector<HTMLElement>('.editor')!
  const width = editor.getBoundingClientRect().width
  get('resizer').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
  check(editor.getBoundingClientRect().width > width, '分隔条键盘调整失效')
  passed.push('防抖、取消自动编译、快捷键、Tab 与分栏调整')

  const extension = canvas.getContext('webgl')!.getExtension('WEBGL_lose_context')
  check(extension, '缺少上下文恢复测试所需扩展')
  const beforeLoss = inspect().compileCount
  extension.loseContext()
  await until(() => !inspect().ready, '未检测到上下文丢失')
  await sleep(150)
  extension.restoreContext()
  await until(() => inspect().ready && inspect().compileCount > beforeLoss, '上下文恢复失败')
  color([255, 0, 0, 255])
  passed.push('WebGL 上下文丢失与最后有效源码恢复')

  const presetPixels: string[] = []
  for (const name of ['grid', 'wave', 'nebula']) {
    document.querySelector<HTMLButtonElement>(`[data-preset="${name}"]`)!.click()
    click('restore')
    const state = inspect()
    check(state.ready && !state.error && state.glError === 0, `${name} 预设失败：${state.error}`)
    presetPixels.push(state.pixel.join(','))
  }
  check(new Set(presetPixels).size === 3, '三种预设没有产生不同像素')
  check(Boolean(localStorage.getItem('guix-glsl-studio-v1')), '草稿未保存')
  click('play')
  const time = inspect().time
  await until(() => inspect().time > time, '恢复播放后时间未推进')
  passed.push('三种实际预设、草稿保存与恢复播放')
  return JSON.stringify({ passed, final: inspect() })
}

Object.assign(window, { editorSmoke })
