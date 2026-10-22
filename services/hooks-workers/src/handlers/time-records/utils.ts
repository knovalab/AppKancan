export function buildTimestamp(
	dateStr: string,
	timeStr: string | null | undefined,
): string | null {
	if (!timeStr) return null;
	if (timeStr.includes('T')) {
		const d = new Date(timeStr);
		return Number.isNaN(d.getTime()) ? null : d.toISOString();
	}
	const time = timeStr.trim();
	const fullTime =
		time.length === 5
			? `${time}:00.000Z`
			: time.includes('.')
				? `${time}Z`
				: `${time}.000Z`;
	const d = new Date(`${dateStr}T${fullTime}`);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function getTodayDateStr(): string {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export function extractStoreId(storeRaw: unknown): string | null {
	if (!storeRaw) return null;
	if (typeof storeRaw === 'object' && 'id' in (storeRaw as any)) {
		return String((storeRaw as any).id);
	}
	return String(storeRaw);
}

/**
 * Extracts key for create payload: { key: number | string }
 */
export function extractCreateKey(payload: any): number | string | null {
	if (!payload) return null;
	if (typeof payload === 'object') {
		return payload.key ?? payload.id ?? null;
	}
	return payload;
}

/**
 * Extracts key for update payload: { keys: number[] } or { key: number[] }
 */
export function extractUpdateKey(payload: any): number | string | null {
	if (!payload) return null;
	if (typeof payload === 'object') {
		if (Array.isArray(payload.keys) && payload.keys.length > 0)
			return payload.keys[0];
		if (Array.isArray(payload.key) && payload.key.length > 0)
			return payload.key[0];
		return payload.key ?? payload.keys ?? payload.id ?? null;
	}
	return payload;
}
