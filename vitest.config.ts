import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    // 原生 GPUI 测试窗口共享进程资源，禁止并发执行。
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
