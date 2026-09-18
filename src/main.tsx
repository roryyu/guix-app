import { render } from '@gpuix/react'
import { App } from './App'

// 入口与组件分离，测试导入 App 时不会意外创建桌面窗口。
// render() 管理原生窗口和节流后的事件循环，不手写逐帧 setState。
render(<App />, {
  title: 'GPUIX · 图形实验室',
  appName: '图形实验室',
  width: 1180,
  height: 820,
  minWidth: 1060,
  minHeight: 760,
  focus: process.env.GPUIX_BACKGROUND !== '1',
})
