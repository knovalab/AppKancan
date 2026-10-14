import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup React components and hooks after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
