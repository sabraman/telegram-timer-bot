/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 10000, // Increase timeout for coverage mode
    hookTimeout: 10000, // Increase hook timeout
    define: {
      // Define process.env variables for test environment
      'process.env.TG_API_TOKEN': '"test-token-for-testing"',
      'process.env.NODE_ENV': '"test"',
    },
    env: {
      TG_API_TOKEN: 'test-token-for-testing',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'refactor/',
      ],
    },
  },
});