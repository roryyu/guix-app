import { buildFragmentSource } from './source'

export interface Parameters {
  speed: number
  scale: number
  iterations: number
  detail: number
  preset: number
}
export interface FrameStats { width: number; height: number; fps: number; time: number; frame: number }
export type MessageKind = 'ok' | 'error' | 'warning'

export class ShaderRenderer {
  readonly params: Parameters = { speed: 1, scale: 28, iterations: 17, detail: 27, preset: 0 }
  playing = true
  lastError = ''
  compileCount = 0
  private gl: WebGLRenderingContext
  private program: WebGLProgram | null = null
  private buffer: WebGLBuffer | null = null
  private texture: WebGLTexture | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private attribute = -1
  private lastGood: { vertex: string; fragment: string } | null = null
  private lost = false
  private disposed = false
  private needsResize = true
  private raf = 0
  private lastTime = performance.now()
  private time = 0
  private frame = 0
  private fps = 0
  private fpsFrames = 0
  private fpsStarted = performance.now()
  private pointer = [0, 0, 0, 0]
  private pressed = false
  private observer: ResizeObserver
  private events = new AbortController()

  constructor(
    readonly canvas: HTMLCanvasElement,
    private message: (text: string, kind: MessageKind) => void,
    private stats: (value: FrameStats) => void,
  ) {
    const context = canvas.getContext('webgl', {
      alpha: false, depth: false, stencil: false, antialias: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance',
    })
    if (!context) throw new Error('WebGL 不可用：请检查系统 GPU 或 WebKit 设置。')
    this.gl = context
    this.createResources()
    this.observer = new ResizeObserver(() => { this.needsResize = true; this.invalidate() })
    this.observer.observe(canvas)
    const options = { signal: this.events.signal }
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault()
      this.lost = true
      this.program = null
      this.buffer = null
      this.texture = null
      cancelAnimationFrame(this.raf)
      this.raf = 0
      this.message('WebGL 上下文丢失，等待恢复。', 'warning')
    }, options)
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false
      this.needsResize = true
      this.lastTime = performance.now()
      try {
        this.createResources()
        if (this.lastGood) this.compile(this.lastGood.vertex, this.lastGood.fragment)
      } catch (error) { this.message(String(error), 'error') }
    }, options)
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(this.raf)
      this.raf = 0
      this.lastTime = performance.now()
      this.fpsStarted = this.lastTime
      this.fpsFrames = 0
      if (!document.hidden) this.invalidate()
    }, options)
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      canvas.setPointerCapture(event.pointerId)
      this.pressed = true
      this.setPointer(event, true)
    }, options)
    canvas.addEventListener('pointermove', (event) => this.setPointer(event, false), options)
    const release = () => { this.pressed = false; this.invalidate() }
    canvas.addEventListener('pointerup', release, options)
    canvas.addEventListener('pointercancel', release, options)
    canvas.addEventListener('lostpointercapture', release, options)
  }

  private createResources() {
    const gl = this.gl
    gl.getExtension('OES_standard_derivatives')
    this.buffer = gl.createBuffer()
    this.texture = gl.createTexture()
    if (!this.buffer || !this.texture) throw new Error('无法分配 WebGL 资源。')
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  private shader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)
    if (!shader) throw new Error('无法创建 Shader。')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? '未知编译错误'
      gl.deleteShader(shader)
      throw new Error(`[${type === gl.VERTEX_SHADER ? 'VERT' : 'FRAGMENT'}] ${log}`)
    }
    return shader
  }

  compile(vertex: string, fragment: string): boolean {
    const gl = this.gl
    let vs: WebGLShader | null = null
    let fs: WebGLShader | null = null
    let candidate: WebGLProgram | null = null
    try {
      if (this.lost || this.disposed) throw new Error('WebGL 上下文当前不可用。')
      const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ? 'highp' : 'mediump'
      const built = buildFragmentSource(fragment, Boolean(gl.getExtension('OES_standard_derivatives')), precision)
      vs = this.shader(gl.VERTEX_SHADER, vertex)
      fs = this.shader(gl.FRAGMENT_SHADER, built.source)
      candidate = gl.createProgram()
      if (!candidate) throw new Error('无法创建 Program。')
      gl.attachShader(candidate, vs)
      gl.attachShader(candidate, fs)
      gl.linkProgram(candidate)
      if (!gl.getProgramParameter(candidate, gl.LINK_STATUS)) throw new Error(`[LINK] ${gl.getProgramInfoLog(candidate)}`)
      const attribute = gl.getAttribLocation(candidate, 'a_pos')
      if (attribute < 0) throw new Error('VERT 必须使用 attribute vec2 a_pos 提供顶点位置。')

      // 只有候选程序完全成功后才替换旧程序；失败时画面继续播放最后一次有效代码。
      if (this.attribute >= 0) gl.disableVertexAttribArray(this.attribute)
      if (this.program) gl.deleteProgram(this.program)
      this.program = candidate
      candidate = null
      this.attribute = attribute
      gl.useProgram(this.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
      gl.enableVertexAttribArray(attribute)
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0)
      this.uniforms = {}
      const count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS) as number
      for (let index = 0; index < count; index++) {
        const info = gl.getActiveUniform(this.program, index)
        if (info) this.uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(this.program, info.name)
      }
      this.lastGood = { vertex, fragment }
      this.lastError = ''
      this.compileCount++
      this.message(`编译成功 · #${this.compileCount}${built.warnings.length ? '\n兼容处理：' + built.warnings.join('；') : ''}`,
        built.warnings.length ? 'warning' : 'ok')
      this.invalidate()
      return true
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.message(`${this.lastError}\n保留上一次有效画面。`, 'error')
      return false
    } finally {
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
      if (candidate) gl.deleteProgram(candidate)
    }
  }

  setPlaying(value: boolean) {
    this.playing = value
    this.lastTime = performance.now()
    this.fps = 0
    this.fpsFrames = 0
    this.fpsStarted = this.lastTime
    this.invalidate()
  }

  private setPointer(event: PointerEvent, clicked: boolean) {
    const rect = this.canvas.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)))
    const y = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / Math.max(rect.height, 1)))
    this.pointer[0] = x
    this.pointer[1] = y
    if (clicked) { this.pointer[2] = x; this.pointer[3] = y }
    this.invalidate()
  }

  invalidate() {
    if (this.raf || this.lost || this.disposed || document.hidden) return
    this.raf = requestAnimationFrame((now) => {
      this.raf = 0
      const elapsed = Math.max(0, (now - this.lastTime) / 1000)
      this.lastTime = now
      const delta = this.playing ? Math.min(elapsed, 0.1) * this.params.speed : 0
      this.time += delta
      if (this.playing) this.frame++
      this.draw(delta)
      this.fpsFrames++
      if (now - this.fpsStarted >= 500) {
        this.fps = this.fpsFrames * 1000 / (now - this.fpsStarted)
        this.fpsFrames = 0
        this.fpsStarted = now
      }
      this.stats({ width: this.canvas.width, height: this.canvas.height,
        fps: this.playing ? Math.round(this.fps) : 0, time: this.time, frame: this.frame })
      if (this.playing) this.invalidate()
    })
  }

  private draw(delta: number) {
    if (!this.program || this.lost || this.disposed) return
    const gl = this.gl
    if (this.needsResize) {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096)
      const width = Math.max(1, Math.min(max, Math.floor(this.canvas.clientWidth * dpr)))
      const height = Math.max(1, Math.min(max, Math.floor(this.canvas.clientHeight * dpr)))
      this.canvas.width = width
      this.canvas.height = height
      gl.viewport(0, 0, width, height)
      this.needsResize = false
    }
    const { width, height } = this.canvas
    const u = (name: string) => this.uniforms[name] ?? null
    gl.useProgram(this.program)
    gl.uniform3f(u('iResolution'), width, height, 1)
    gl.uniform1f(u('iTime'), this.time)
    gl.uniform1f(u('iTimeDelta'), delta)
    gl.uniform1i(u('iFrame'), this.frame)
    gl.uniform1f(u('iFrameRate'), this.fps)
    gl.uniform1f(u('iSampleRate'), 44100)
    const [mx = 0, my = 0, cx = 0, cy = 0] = this.pointer
    gl.uniform4f(u('iMouse'), mx * width, my * height,
      (this.pressed ? 1 : -1) * Math.max(0.001, cx * width), (this.pressed ? 1 : -1) * Math.max(0.001, cy * height))
    const date = new Date()
    gl.uniform4f(u('iDate'), date.getFullYear(), date.getMonth(), date.getDate(),
      date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000)
    gl.uniform2f(u('u_resolution'), width, height)
    gl.uniform1f(u('u_time'), this.time)
    gl.uniform2f(u('u_mouse'), mx * width, my * height)
    gl.uniform1f(u('u_scale'), this.params.scale)
    gl.uniform1f(u('u_preset'), this.params.preset)
    gl.uniform1i(u('u_iterations'), this.params.iterations)
    gl.uniform1i(u('u_detail'), this.params.detail)
    gl.uniform3fv(u('iChannelResolution'), new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]))
    gl.uniform1fv(u('iChannelTime'), new Float32Array(4))
    for (let index = 0; index < 4; index++) {
      gl.activeTexture(gl.TEXTURE0 + index)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.uniform1i(u(`iChannel${index}`), index)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  // 诊断只按需读取像素，正常渲染循环不执行同步 GPU 回读。
  inspect() {
    this.draw(0)
    const pixel = new Uint8Array(4)
    this.gl.readPixels(Math.floor(this.canvas.width / 2), Math.floor(this.canvas.height / 2),
      1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel)
    return { ready: Boolean(this.program) && !this.lost, error: this.lastError,
      compileCount: this.compileCount, playing: this.playing, time: this.time,
      frame: this.frame, params: { ...this.params }, width: this.canvas.width, height: this.canvas.height,
      pixel: Array.from(pixel), glError: this.gl.getError() }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.observer.disconnect()
    this.events.abort()
    this.gl.deleteProgram(this.program)
    this.gl.deleteBuffer(this.buffer)
    this.gl.deleteTexture(this.texture)
  }
}
