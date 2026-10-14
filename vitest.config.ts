import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@resoluciones': path.resolve(__dirname, './src/apps/resoluciones'),
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/apps/horarios/__test__/setup.ts'],
		include: ['src/apps/horarios/__test__/**/*.test.{ts,tsx}'],
	},
});

