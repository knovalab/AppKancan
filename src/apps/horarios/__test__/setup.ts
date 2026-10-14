import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { afterEach, vi } from 'vitest';

dayjs.extend(customParseFormat);

// Cleanup React components and hooks after each test
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
