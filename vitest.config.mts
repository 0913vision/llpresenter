import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// 최소 설정. 시험 도우미, 시험 범위 보고, 메인과 화면 코드 나누기는 devops가 넓힌다.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
