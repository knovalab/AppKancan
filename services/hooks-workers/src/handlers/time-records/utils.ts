const DEFAULT_TIMEZONE = process.env.SERVICE_TIMEZONE || 'America/Bogota';

/**
 * Calculates the UTC offset in minutes for a given date in a specific timezone.
 * Returns e.g. -300 for America/Bogota (UTC-5).
 */
export function getTimeZoneOffsetMinutes(
	date: Date,
	timeZone: string = DEFAULT_TIMEZONE,
): number {
	try {
		const dtf = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hour12: false,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		const parts = dtf.formatToParts(date);
		const get = (type: string) =>
			parts.find((p) => p.type === type)?.value ?? '00';

		const year = Number(get('year'));
		const month = Number(get('month')) - 1;
		const day = Number(get('day'));
		let hour = Number(get('hour'));
		if (hour === 24) hour = 0;
		const minute = Number(get('minute'));
		const second = Number(get('second'));

		const asUTC = Date.UTC(year, month, day, hour, minute, second);
		return Math.round((asUTC - date.getTime()) / 60000);
	} catch {
		// Fallback to Bogota offset (-300 min) if timezone is invalid
		return -300;
	}
}

/**
 * Constructs a normalized ISO 8601 timestamp string from a date string (YYYY-MM-DD)
 * and time string (HH:mm or HH:mm:ss).
 */
export function buildTimestamp(
	dateStr: string,
	timeStr: string | null | undefined,
): string | null {
	if (!timeStr) return null;

	const trimmed = timeStr.trim();
	if (trimmed.includes('T')) {
		const d = new Date(trimmed);
		return Number.isNaN(d.getTime()) ? null : d.toISOString();
	}

	const fullTime =
		trimmed.length === 5
			? `${trimmed}:00.000Z`
			: trimmed.includes('.')
				? `${trimmed}Z`
				: `${trimmed}.000Z`;

	const d = new Date(`${dateStr}T${fullTime}`);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Retrieves the current date string (YYYY-MM-DD) in the service timezone (America/Bogota by default).
 */
export function getTodayDateStr(timeZone: string = DEFAULT_TIMEZONE): string {
	try {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
		return formatter.format(new Date());
	} catch {
		const now = new Date();
		const yyyy = now.getUTCFullYear();
		const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
		const dd = String(now.getUTCDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`;
	}
}

export function extractStoreId(storeRaw: unknown): string | null {
	if (!storeRaw) return null;
	if (typeof storeRaw === 'object' && 'id' in (storeRaw as any)) {
		return String((storeRaw as any).id);
	}
	return String(storeRaw);
}
