import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { fetchTimeRecords } from '../api/directus/read';
import { LOG_TYPE } from '../domain/registro';
import { coordenadasDe } from '../domain/ubicacion';
import type { TimeRecordDto } from '../interfaces/api/timeRecords';
import type { Tienda } from '../interfaces/tiendas';

export interface UseMonitoreoLocalizacionProps {
	tiendas: Tienda[];
	initialFechaInicio?: Dayjs | null;
	initialFechaFin?: Dayjs | null;
}

export interface LocalizacionRecordItem {
	record: TimeRecordDto;
	lat: number;
	lon: number;
	accuracy: number | null;
}

export interface LocalizacionLogTypeSection {
	logType: string;
	count: number;
	items: LocalizacionRecordItem[];
}

export interface LocalizacionDateGroup {
	date: string;
	dateFormatted: string;
	dateLabel: string;
	totalRecords: number;
	sections: LocalizacionLogTypeSection[];
}

export interface LocalizacionStoreGroup {
	storeId: number;
	storeName: string;
	totalRecords: number;
	dates: LocalizacionDateGroup[];
}

const PREFERRED_LOG_ORDER: string[] = [
	LOG_TYPE.inicioJornada, // 'Comenzar Jornada'
	LOG_TYPE.inicioAlmuerzo, // 'Iniciar Almuerzo'
	LOG_TYPE.finAlmuerzo, // 'Finalizar Almuerzo'
	LOG_TYPE.finJornada, // 'Terminar Jornada'
];

export function useMonitoreoLocalizacion({
	tiendas,
	initialFechaInicio,
	initialFechaFin,
}: UseMonitoreoLocalizacionProps) {
	// Default to today for daily supervisor GPS auditing
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(
		() => initialFechaInicio ?? dayjs(),
	);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(
		() => initialFechaFin ?? dayjs(),
	);
	const [searchEmpleado, setSearchEmpleado] = useState('');

	const storeIds = useMemo(
		() => tiendas.map((t) => Number(t.id)).filter(Boolean),
		[tiendas],
	);

	const storesMap = useMemo(
		() => new Map<number, string>(tiendas.map((t) => [Number(t.id), t.name])),
		[tiendas],
	);

	const fechaInicioStr = fechaInicio ? fechaInicio.format('YYYY-MM-DD') : '';
	const fechaFinStr = fechaFin ? fechaFin.format('YYYY-MM-DD') : '';

	// Fetch time records for the selected stores & date range
	const {
		data: allRecords = [],
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [
			'monitoreoLocalizacionTimeRecords',
			storeIds.join(','),
			fechaInicioStr,
			fechaFinStr,
		],
		queryFn: async () => {
			if (storeIds.length === 0) return [];
			return fetchTimeRecords(
				fechaInicioStr || undefined,
				fechaFinStr || undefined,
				storeIds,
			);
		},
		enabled: storeIds.length > 0,
		staleTime: 2 * 60 * 1000,
	});

	// Pure local filtering: Keep only records that have valid GPS coordinates & match search query
	const recordsWithGps = useMemo<LocalizacionRecordItem[]>(() => {
		const query = searchEmpleado.toLowerCase().trim();
		const result: LocalizacionRecordItem[] = [];

		for (const record of allRecords) {
			const { latitud, longitud } = coordenadasDe(record);
			if (
				latitud == null ||
				longitud == null ||
				Number.isNaN(Number(latitud)) ||
				Number.isNaN(Number(longitud))
			) {
				continue;
			}

			const lat = Number(latitud);
			const lon = Number(longitud);

			// Exclude uninitialized (0, 0) dummy coordinates
			if (lat === 0 && lon === 0) {
				continue;
			}

			if (query) {
				const emp = record.employee_id;
				const fullName = [
					emp?.first_name,
					emp?.middle_name,
					emp?.last_name,
					emp?.second_last_name,
				]
					.filter(Boolean)
					.join(' ')
					.toLowerCase();
				const doc = String(emp?.document_number || '');

				if (!fullName.includes(query) && !doc.includes(query)) {
					continue;
				}
			}

			result.push({
				record,
				lat,
				lon,
				accuracy: record.accuracy ?? null,
			});
		}

		return result;
	}, [allRecords, searchEmpleado]);

	// Hierarchical grouping: Store -> Date -> LogType
	// Ensures no mixing of different stores and no mixing of different dates
	const storeGroups = useMemo<LocalizacionStoreGroup[]>(() => {
		const storeMap = new Map<
			number,
			{
				storeId: number;
				storeName: string;
				dateMap: Map<string, Record<string, LocalizacionRecordItem[]>>;
			}
		>();

		for (const item of recordsWithGps) {
			const { record } = item;
			const storeObj =
				record.store_id && typeof record.store_id === 'object'
					? record.store_id
					: null;
			const storeId = Number(storeObj?.id ?? record.store_id ?? 0);
			const storeName =
				storeObj?.name ??
				storesMap.get(storeId) ??
				(storeId > 0 ? `Tienda #${storeId}` : 'Tienda Desconocida');

			const date = record.record_date || 'Sin fecha';
			const type = record.log_type || 'Sin Tipo';

			let storeEntry = storeMap.get(storeId);
			if (!storeEntry) {
				storeEntry = {
					storeId,
					storeName,
					dateMap: new Map(),
				};
				storeMap.set(storeId, storeEntry);
			}

			let dateGroup = storeEntry.dateMap.get(date);
			if (!dateGroup) {
				dateGroup = {};
				storeEntry.dateMap.set(date, dateGroup);
			}

			if (!dateGroup[type]) {
				dateGroup[type] = [];
			}
			dateGroup[type].push(item);
		}

		const result: LocalizacionStoreGroup[] = [];

		for (const storeEntry of storeMap.values()) {
			const dates: LocalizacionDateGroup[] = [];
			let storeTotalRecords = 0;

			// Sort dates descending (most recent date first)
			const sortedDates = Array.from(storeEntry.dateMap.keys()).sort((a, b) =>
				b.localeCompare(a),
			);

			for (const dateKey of sortedDates) {
				const logTypeRecordMap = storeEntry.dateMap.get(dateKey) || {};
				const presentKeys = Object.keys(logTypeRecordMap);

				const sortedLogTypes = presentKeys.sort((a, b) => {
					const idxA = PREFERRED_LOG_ORDER.indexOf(a);
					const idxB = PREFERRED_LOG_ORDER.indexOf(b);
					if (idxA !== -1 && idxB !== -1) return idxA - idxB;
					if (idxA !== -1) return -1;
					if (idxB !== -1) return 1;
					return a.localeCompare(b);
				});

				// Strictly keep only log types with at least 1 record (no empty section titles)
				const sections: LocalizacionLogTypeSection[] = sortedLogTypes
					.filter((type) => logTypeRecordMap[type]?.length > 0)
					.map((type) => ({
						logType: type,
						count: logTypeRecordMap[type].length,
						items: logTypeRecordMap[type],
					}));

				const dateRecordsCount = sections.reduce((acc, s) => acc + s.count, 0);

				if (dateRecordsCount > 0) {
					storeTotalRecords += dateRecordsCount;
					const parsedDate = dayjs(dateKey);
					const formatted = parsedDate.isValid()
						? parsedDate.format('DD/MM/YYYY')
						: dateKey;
					const label = parsedDate.isValid()
						? parsedDate.format('dddd, DD [de] MMMM [de] YYYY')
						: dateKey;

					dates.push({
						date: dateKey,
						dateFormatted: formatted,
						dateLabel: label.charAt(0).toUpperCase() + label.slice(1),
						totalRecords: dateRecordsCount,
						sections,
					});
				}
			}

			if (storeTotalRecords > 0) {
				result.push({
					storeId: storeEntry.storeId,
					storeName: storeEntry.storeName,
					totalRecords: storeTotalRecords,
					dates,
				});
			}
		}

		// Sort stores alphabetically by storeName
		return result.sort((a, b) => a.storeName.localeCompare(b.storeName));
	}, [recordsWithGps, storesMap]);

	const totalRecords = recordsWithGps.length;

	return {
		fechaInicio,
		setFechaInicio,
		fechaFin,
		setFechaFin,
		searchEmpleado,
		setSearchEmpleado,
		loading,
		refetch,
		storeGroups,
		totalRecords,
	};
}

