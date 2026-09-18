import type { StyleDesc } from '@gpuix/react'

export const colors = {
  background: '#101316',
  sidebar: '#15191D',
  surface: '#1B2025',
  elevated: '#252C33',
  border: '#303941',
  text: '#EDF1EB',
  muted: '#9AA6AD',
  faint: '#65747E',
  accent: '#D7F98B',
  ink: '#172013',
  grid: '#242D34',
}

export const palettes = {
  lime: { name: '青柠', from: '#D7F98B', to: '#4BA78C' },
  violet: { name: '紫雾', from: '#CAB7FF', to: '#7972EA' },
  coral: { name: '珊瑚', from: '#FFCE99', to: '#EA787B' },
} as const
export type PaletteId = keyof typeof palettes

export const row: StyleDesc = { display: 'flex', flexDirection: 'row', alignItems: 'center' }
export const column: StyleDesc = { display: 'flex', flexDirection: 'column' }
export const panel: StyleDesc = {
  ...column, backgroundColor: colors.surface, borderRadius: 12,
  borderWidth: 1, borderColor: colors.border,
}

// GPUI 不继承文字颜色，所有文字都经由此样式显式赋色。
export function textStyle(size = 13, color: string = colors.text): StyleDesc {
  return { fontSize: size, color, fontFamily: process.platform === 'darwin' ? 'PingFang SC' : 'sans-serif' }
}
