import { PRESETS, SLIDERS, VERTEX_SOURCE, type Preset } from './presets'
import { ShaderRenderer, type MessageKind } from './renderer'

function element<T extends HTMLElement>(id: string): T {
  const found = document.querySelector<T>(`#${id}`)
  if (!found) throw new Error(`页面缺少元素：${id}`)
  return found
}

declare global {
  interface Window { shaderLab?: ReturnType<typeof startEditor> }
}

function startEditor() {
  const canvas = element<HTMLCanvasElement>('gl')
  const code = element<HTMLTextAreaElement>('code')
  const auto = element<HTMLInputElement>('auto')
  const consoleOutput = element('console')
  const drafts: Record<Preset, string> = { ...PRESETS }
  let vertex = VERTEX_SOURCE
  let preset: Preset = 'nebula'
  let tab: 'vertex' | 'fragment' = 'fragment'
  let timer: ReturnType<typeof setTimeout> | undefined
  const storageKey = 'guix-glsl-studio-v1'
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (stored && typeof stored === 'object') {
      for (const key of Object.keys(PRESETS) as Preset[]) {
        const value: unknown = Reflect.get(stored, key)
        if (typeof value === 'string' && value.length <= 256_000) drafts[key] = value
      }
      const value: unknown = Reflect.get(stored, 'vertex')
      if (typeof value === 'string' && value.length <= 256_000) vertex = value
    }
  } catch { /* 文件模式或隐私环境不支持存储时，编辑功能仍可使用。 */ }

  function message(text: string, kind: MessageKind) {
    consoleOutput.textContent = text
    consoleOutput.dataset.kind = kind
    element('status').textContent = kind === 'error' ? '编译失败 · 保留有效画面'
      : kind === 'warning' ? 'WebGL · 请查看编译输出' : 'WebGL 1.0 · Shadertoy 兼容'
    element('status-dot').parentElement?.setAttribute('data-kind', kind)
  }
  const renderer = new ShaderRenderer(canvas, message, (stats) => {
    element('resolution').textContent = `${stats.width} × ${stats.height}`
    element('fps').textContent = renderer.playing ? `${stats.fps || '—'} FPS` : '已暂停'
    element('time').textContent = `${stats.time.toFixed(2)} s`
  })

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({ ...drafts, vertex })) }
    catch { /* 存储失败不应阻断着色器编译。 */ }
  }
  function updateLines() {
    const count = code.value.split('\n').length
    element('lines').textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join('\n')
    element('position').textContent = `${count} 行`
    element('lines').scrollTop = code.scrollTop
  }
  function compile() {
    clearTimeout(timer)
    const success = renderer.compile(vertex, drafts[preset])
    persist()
    return success
  }
  function updateSource() {
    if (tab === 'vertex') vertex = code.value
    else drafts[preset] = code.value
    persist()
    updateLines()
    clearTimeout(timer)
    if (auto.checked) timer = setTimeout(compile, 600)
  }
  function selectTab(value: typeof tab) {
    tab = value
    code.value = value === 'vertex' ? vertex : drafts[preset]
    code.setAttribute('aria-label', `${value === 'vertex' ? 'Vertex' : 'Fragment'} Shader 源码`)
    element('tab-vertex').setAttribute('aria-selected', String(value === 'vertex'))
    element('tab-fragment').setAttribute('aria-selected', String(value === 'fragment'))
    updateLines()
  }
  function selectPreset(value: Preset) {
    preset = value
    renderer.params.preset = Object.keys(PRESETS).indexOf(value)
    document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.preset === value))
    })
    selectTab('fragment')
    updatePlay()
    compile()
  }
  function updatePlay() {
    const play = element<HTMLButtonElement>('play')
    play.textContent = renderer.playing ? 'Ⅱ' : '▶'
    play.setAttribute('aria-label', renderer.playing ? '暂停' : '播放')
    element('live').textContent = `${renderer.playing ? 'LIVE' : 'PAUSED'} / ${preset.toUpperCase()}`
  }

  code.addEventListener('input', updateSource)
  code.addEventListener('scroll', () => { element('lines').scrollTop = code.scrollTop })
  code.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end')
      updateSource()
    }
  })
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && (event.key === 's' || event.key === 'Enter')) {
      event.preventDefault()
      compile()
    }
  })
  auto.addEventListener('change', () => {
    clearTimeout(timer)
    if (auto.checked) compile()
  })
  element('tab-vertex').addEventListener('click', () => selectTab('vertex'))
  element('tab-fragment').addEventListener('click', () => selectTab('fragment'))
  element('run').addEventListener('click', compile)
  element('play').addEventListener('click', () => { renderer.setPlaying(!renderer.playing); updatePlay() })
  element('restore').addEventListener('click', () => {
    drafts[preset] = PRESETS[preset]
    vertex = VERTEX_SOURCE
    selectTab(tab)
    compile()
  })
  for (const key of Object.keys(PRESETS) as Preset[]) {
    document.querySelector<HTMLButtonElement>(`[data-preset="${key}"]`)?.addEventListener('click', () => selectPreset(key))
  }
  for (const key of Object.keys(SLIDERS) as (keyof typeof SLIDERS)[]) {
    const input = element<HTMLInputElement>(key)
    const definition = SLIDERS[key]
    input.addEventListener('input', () => {
      let value = Number(input.value)
      if (!Number.isFinite(value)) value = definition.initial
      value = Math.min(definition.max, Math.max(definition.min, value))
      if (definition.step === 1) value = Math.round(value)
      renderer.params[key] = value
      element(`${key}-value`).textContent = key === 'speed' ? `${value.toFixed(1)}x`
        : definition.step === 1 ? String(value) : value.toFixed(1)
      renderer.invalidate()
    })
  }

  const resizer = element('resizer')
  const editor = document.querySelector<HTMLElement>('.editor')!
  function resize(width: number) {
    const max = Math.min(innerWidth * 0.6, innerWidth - 305)
    const value = Math.max(320, Math.min(max, width))
    document.documentElement.style.setProperty('--editor-width', `${value}px`)
    resizer.setAttribute('aria-valuenow', String(Math.round(value)))
  }
  resizer.addEventListener('pointerdown', (event) => {
    resizer.setPointerCapture(event.pointerId)
    resizer.classList.add('dragging')
    event.preventDefault()
  })
  resizer.addEventListener('pointermove', (event) => {
    if (resizer.hasPointerCapture(event.pointerId)) resize(innerWidth - event.clientX)
  })
  resizer.addEventListener('lostpointercapture', () => resizer.classList.remove('dragging'))
  resizer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      resize(editor.getBoundingClientRect().width + (event.key === 'ArrowLeft' ? 20 : -20))
    }
  })
  window.addEventListener('resize', () => resize(editor.getBoundingClientRect().width))
  window.addEventListener('pagehide', () => { clearTimeout(timer); persist(); renderer.dispose() }, { once: true })

  selectTab('fragment')
  // 先准备可靠的回退画面，再尝试恢复用户草稿，避免错误草稿导致下次启动黑屏。
  renderer.compile(VERTEX_SOURCE, PRESETS.nebula)
  if (vertex !== VERTEX_SOURCE || drafts.nebula !== PRESETS.nebula) compile()
  return { inspect: () => renderer.inspect(), compile }
}

try { window.shaderLab = startEditor() }
catch (error) {
  element('status').textContent = 'WebGL 初始化失败'
  element('console').textContent = error instanceof Error ? error.message : String(error)
  element('console').dataset.kind = 'error'
}
