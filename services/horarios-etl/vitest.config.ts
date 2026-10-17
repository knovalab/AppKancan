import { defineConfig } from 'vitest/config';

// Configuración propia: sin ella, vitest sube hasta la raíz del repo y usa la del frontend.
export default defineConfig({
	test: {
		root: import.meta.dirname,
		include: ['test/**/*.test.ts'],
		environment: 'node',
	},
});
