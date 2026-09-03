import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts'],
    // Starts one Postgres testcontainer for the whole run, migrated and seeded.
    globalSetup: ['./src/integration/globalSetup.ts'],
    clearMocks: true,
    globals: true,
  },
});
