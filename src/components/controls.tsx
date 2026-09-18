import type { ReactNode } from 'react'
import type { StyleDesc } from '@gpuix/react'
import { colors, column, row, textStyle } from '../theme'

interface ButtonProps {
  children: ReactNode
  testId: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  style?: StyleDesc
  label?: string
}

// GPUIX 没有 DOM button；显式提供焦点、键盘操作和无障碍语义。
export function Button({ children, testId, onClick, active, disabled, style, label }: ButtonProps) {
  const activate = () => { if (!disabled) onClick() }
  return (
    <div
      testId={testId}
      role="button"
      aria-label={label ?? (typeof children === 'string' ? children : testId)}
      tabIndex={disabled ? -1 : 0}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === 'enter' || event.key === 'space') activate()
      }}
      style={{
        ...row, justifyContent: 'center', gap: 8, padding: 10,
        borderRadius: 7, borderWidth: 1,
        borderColor: active ? colors.accent : colors.border,
        backgroundColor: active ? colors.accent : colors.elevated,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1,
        hover: { borderColor: disabled ? colors.border : colors.accent },
        active: { opacity: disabled ? 0.35 : 0.7 },
        ...style,
      }}
    >
      {typeof children === 'string'
        ? <text style={textStyle(12, active ? colors.ink : colors.text)}>{children}</text>
        : children}
    </div>
  )
}

export function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ ...column, gap: 10 }}>
      <text style={textStyle(11, colors.muted)}>{title}</text>
      {children}
    </div>
  )
}

export function Toggle({ label, enabled, testId, onClick }: {
  label: string; enabled: boolean; testId: string; onClick: () => void
}) {
  return (
    <Button testId={testId} onClick={onClick} label={`${label}：${enabled ? '开启' : '关闭'}`}
      style={{ justifyContent: 'space-between', padding: 9 }}>
      <text style={textStyle(12)}>{label}</text>
      <div style={{ ...row, width: 30, height: 17, padding: 3, borderRadius: 10,
        justifyContent: enabled ? 'flex-end' : 'flex-start',
        backgroundColor: enabled ? colors.accent : colors.faint }}>
        <div style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.background }} />
      </div>
    </Button>
  )
}
