import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { fetchTimeRecords } from '../api/directus/read';
import { LOG_TYPE } from '../domain/registro';
import type { TimeRecordDto } from '../interfaces/api/timeRecords';
import type { Tienda } from '../interfaces/tiendas';

export interface UseMonitoreoFotosProps {
	tiendas: Tienda[];
	initialFechaInicio?: Dayjs | null;
	initialFechaFin?: Dayjs | null;
}

export interface FotoLogTypeSection {
	logType: string;
	count: number;
	records: TimeRecordDto[];
}

export interface FotoDateGroup {
	date: string;
	dateFormatted: string;
	dateLabel: string;
	totalPhotos: number;
	sections: FotoLogTypeSection[];
}

export interface FotoStoreGroup {
	storeId: number;
	storeName: string;
	totalPhotos: number;
	dates: FotoDateGroup[];
}

const PREFERRED_LOG_ORDER: string[] = [
	LOG_TYPE.inicioJornada, // 'Comenzar Jornada'
	LOG_TYPE.inicioAlmuerzo, // 'Iniciar Almuerzo'
	LOG_TYPE.finAlmuerzo, // 'Finalizar Almuerzo'
	LOG_TYPE.finJornada, // 'Terminar Jornada'
];

export function useMonitoreoFotos({
	tiendas,
	initialFechaInicio,
	initialFechaFin,
}: UseMonitoreoFotosProps) {
	// Default to today for daily supervisor photo review
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
			'monitoreoFotosTimeRecords',
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

	// Pure local filtering: Keep only records that have a valid photo, filtered by search query
	const recordsWithPhoto = useMemo(() => {
		const query = searchEmpleado.toLowerCase().trim();

		return allRecords.filter((record: TimeRecordDto) => {
			if (!record.photo) return false;

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
					return false;
				}
			}

			return true;
		});
	}, [allRecords, searchEmpleado]);

	// Hierarchical grouping: Store -> Date -> LogType
	// Ensures no mixing of different stores and no mixing of different dates
	const storeGroups = useMemo<FotoStoreGroup[]>(() => {
		const storeMap = new Map<
			number,
			{
				storeId: number;
				storeName: string;
				dateMap: Map<string, Record<string, TimeRecordDto[]>>;
			}
		>();

		for (const record of recordsWithPhoto) {
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
			dateGroup[type].push(record);
		}

		const result: FotoStoreGroup[] = [];

		for (const storeEntry of storeMap.values()) {
			const dates: FotoDateGroup[] = [];
			let storeTotalPhotos = 0;

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
				const sections: FotoLogTypeSection[] = sortedLogTypes
					.filter((type) => logTypeRecordMap[type]?.length > 0)
					.map((type) => ({
						logType: type,
						count: logTypeRecordMap[type].length,
						records: logTypeRecordMap[type],
					}));

				const datePhotosCount = sections.reduce((acc, s) => acc + s.count, 0);

				if (datePhotosCount > 0) {
					storeTotalPhotos += datePhotosCount;
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
						totalPhotos: datePhotosCount,
						sections,
					});
				}
			}

			if (storeTotalPhotos > 0) {
				result.push({
					storeId: storeEntry.storeId,
					storeName: storeEntry.storeName,
					totalPhotos: storeTotalPhotos,
					dates,
				});
			}
		}

		// Sort stores alphabetically by storeName
		return result.sort((a, b) => a.storeName.localeCompare(b.storeName));
	}, [recordsWithPhoto, storesMap]);

	const totalPhotos = recordsWithPhoto.length;

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
		totalPhotos,
	};
}
