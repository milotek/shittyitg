import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  build: { target: 'es2023' },
  test: { include: ['src/**/*.test.ts'] },
})
