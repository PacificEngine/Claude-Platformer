import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The preview harness assigns a free port through PORT.
  server: { port: Number(process.env.PORT) || 5173 },
  test: { include: ['src/**/*.test.ts'] },
});
