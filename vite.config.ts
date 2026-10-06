import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths let the build run from any sub-path (e.g. GitHub Pages project sites).
  base: './',
  // The preview harness assigns a free port through PORT.
  server: { port: Number(process.env.PORT) || 5173 },
  test: { include: ['src/**/*.test.ts'] },
});
