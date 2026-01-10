import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',
        setupFiles: ['./vitest.setup.ts'],
        include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
        globals: true,
        fileParallelism: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
        },
    },
});
