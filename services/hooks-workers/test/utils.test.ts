import { describe, expect, it } from 'vitest';
import {
	buildTimestamp,
	extractStoreId,
	getTimeZoneOffsetMinutes,
	getTodayDateStr,
} from '../src/handlers/time-records/utils.ts';

describe('Time Record Utils', () => {
	it('calculates -300 minutes offset for America/Bogota (UTC-5)', () => {
		const offset = getTimeZoneOffsetMinutes(
			new Date('2026-10-22T12:00:00Z'),
			'America/Bogota',
		);
		expect(offset).toBe(-300);
	});

	it('formats today date string matching YYYY-MM-DD pattern', () => {
		const dateStr = getTodayDateStr('America/Bogota');
		expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('builds standard ISO timestamp correctly from date and time', () => {
		const iso = buildTimestamp('2026-10-22', '08:00');
		expect(iso).toBe('2026-10-22T08:00:00.000Z');
	});

	it('handles already-formed ISO timestamps gracefully', () => {
		const existingIso = '2026-10-22T15:30:00.000Z';
		const result = buildTimestamp('2026-10-22', existingIso);
		expect(result).toBe(existingIso);
	});

	it('returns null for empty or null time input', () => {
		expect(buildTimestamp('2026-10-22', null)).toBeNull();
		expect(buildTimestamp('2026-10-22', undefined)).toBeNull();
		expect(buildTimestamp('2026-10-22', '')).toBeNull();
	});

	it('extracts storeId properly from object or scalar', () => {
		expect(extractStoreId('store-123')).toBe('store-123');
		expect(extractStoreId({ id: 'store-456' })).toBe('store-456');
		expect(extractStoreId({ id: 789 })).toBe('789');
		expect(extractStoreId(null)).toBeNull();
	});
});
