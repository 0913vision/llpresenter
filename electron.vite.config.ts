import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared') }

// 여러 세션이 동시에 개발 서버를 띄울 수 있게 포트를 환경 변수로 받는다(docs/WORKFLOW.md의 배정표).
// 포트가 이미 쓰이면 다른 포트로 몰래 옮기지 않고 실패한다.
const devPort = Number(process.env['LLP_DEV_PORT'] ?? '5173')

export default defineConfig({
  main: {
    resolve: { alias: shared },
  },
  preload: {
    resolve: { alias: shared },
  },
  renderer: {
    resolve: {
      alias: { ...shared, '@renderer': resolve('src/renderer/src') },
    },
    plugins: [react()],
    server: { port: devPort, strictPort: true },
    build: {
      rolldownOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
        },
      },
    },
  },
})
