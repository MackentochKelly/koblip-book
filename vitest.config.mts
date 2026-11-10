import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // Separate checkouts are not part of this repository's test run, and
    // neither is video/: its own package, with its own checks.
    // https://vitest.dev/config/exclude.html
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**', 'video/**'],
  },
})
