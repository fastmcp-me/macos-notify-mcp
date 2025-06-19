import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'MacOSNotifyMCP/**',
        'test/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'scripts/**',
      ],
    },
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
  },
})