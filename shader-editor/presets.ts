export const VERTEX_SOURCE = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

// 来自原 glsl-editor.html；保留常量循环上限，以兼容 GLSL ES 1.0。
const nebula = `void mainImage(out vec4 o, vec2 F) {
    vec2 R = iResolution.xy;
    o = vec4(0.0);
    float t = iTime * 0.1;
    for (int j = 0; j < 40; j++) {
        if (j >= u_iterations) break;
        float i = -0.06 * float(j);
        float d = fract(i - 3.0 * t);
        vec4 c = vec4((F - R * 0.5) / R.y * d, i, 0.0) * u_scale;
        for (int k = 0; k < 60; k++) {
            if (k >= u_detail) break;
            c.xzyw = abs(c / max(dot(c, c), 0.00001)
                - vec4(7.0 - 0.2 * sin(t), 6.3, 0.7, 1.0 - cos(t / 0.8)) / 7.0);
        }
        float dOld = d;
        d -= 1.0;
        o -= c * c.yzww * dOld * d / vec4(3.0, 5.0, 1.0, 1.0);
    }
    o.a = 1.0;
}`

const grid = `void mainImage(out vec4 color, vec2 fragCoord) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    float horizon = uv.y + 0.24;
    float depth = 1.0 / (abs(horizon) + 0.06);
    vec2 p = vec2(uv.x * depth, depth + iTime * 1.5);
    p *= u_scale * 0.12;
    vec2 cell = abs(fract(p) - 0.5);
    float line = 1.0 - smoothstep(0.01, 0.06, min(cell.x, cell.y));
    vec3 ink = mix(vec3(0.02, 0.01, 0.09), vec3(0.1, 0.9, 1.0), line);
    ink *= exp(-depth * 0.06);
    float sun = exp(-length(uv - vec2(0.0, 0.2)) * 10.0);
    ink += vec3(1.0, 0.1, 0.65) * sun;
    color = vec4(ink, 1.0);
}`

const wave = `void mainImage(out vec4 color, vec2 fragCoord) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    vec3 ink = vec3(0.02, 0.01, 0.06);
    float count = float(u_iterations);
    for (int i = 0; i < 40; i++) {
        if (i >= u_iterations) break;
        float phase = float(i) / count;
        float wave = sin(uv.x * u_scale * 0.25 + iTime + phase * 6.28);
        float y = wave * 0.16 + (phase - 0.5) * 0.5;
        float glow = 0.002 / (abs(uv.y - y) + 0.005);
        vec3 tint = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + phase * 6.28);
        ink += tint * glow * 0.28;
    }
    color = vec4(ink, 1.0);
}`

export const PRESETS = { nebula, grid, wave } as const
export type Preset = keyof typeof PRESETS

export const SLIDERS = {
  speed: { min: 0, max: 3, step: 0.1, initial: 1 },
  scale: { min: 1, max: 60, step: 0.1, initial: 28 },
  iterations: { min: 1, max: 40, step: 1, initial: 17 },
  detail: { min: 1, max: 60, step: 1, initial: 27 },
} as const
