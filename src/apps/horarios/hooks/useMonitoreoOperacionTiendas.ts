import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { fetchTimeRecordStore } from '../api/directus/reports';
import type { TimeRecordStoreDto } from '../interfaces/api/timeRecordStore';
import type { RegistroTienda } from '../interfaces/registroTienda';
import type { Tienda } from '../interfaces/tiendas';
import { mapearTimeRecordStoreDtoARegistroTienda } from '../utils/registroTienda';

export interface UseMonitoreoOperacionTiendasProps {
	tiendas: Tienda[];
	initialFechaInicio?: Dayjs | null;
	initialFechaFin?: Dayjs | null;
}

export type StatusFilterOption =
	| 'todos'
	| 'completado'
	| 'en_operacion'
	| 'sin_abrir'
	| 'dia_cerrado';

export interface OperacionKpis {
	totalRegistros: number;
	enOperacion: number;
	completados: number;
	sinAbrir: number;
	totalHoras: number;
}

export function useMonitoreoOperacionTiendas({
	tiendas,
	initialFechaInicio,
	initialFechaFin,
}: UseMonitoreoOperacionTiendasProps) {
	// Default to current month start through today for supervisors
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(
		() => initialFechaInicio ?? dayjs().startOf('month'),
	);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(
		() => initialFechaFin ?? dayjs(),
	);

	const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('todos');
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

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

	// Query Directus com_time_record_store
	const {
		data: rawRecords = [],
		isLoading: loading,
		refetch,
	} = useQuery({
		queryKey: [
			'monitoreoOperacionTiendas',
			storeIds.join(','),
			fechaInicioStr,
			fechaFinStr,
		],
		queryFn: async () => {
			if (storeIds.length === 0) return [];
			return fetchTimeRecordStore(
				fechaInicioStr || undefined,
				fechaFinStr || undefined,
				storeIds,
			);
		},
		enabled: storeIds.length > 0,
		staleTime: 2 * 60 * 1000,
	});

	// Transform raw DTO to standard RegistroTienda
	const recordsCalculados = useMemo(() => {
		return rawRecords.map((r: TimeRecordStoreDto) =>
			mapearTimeRecordStoreDtoARegistroTienda(r, storesMap),
		);
	}, [rawRecords, storesMap]);

	// Filter in-memory by status
	const filteredRecords = useMemo(() => {
		return recordsCalculados.filter((reg: RegistroTienda) => {
			if (statusFilter !== 'todos' && reg.status !== statusFilter) {
				return false;
			}
			return true;
		});
	}, [recordsCalculados, statusFilter]);

	// Reset page when filters change
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset page on filters change
	useEffect(() => {
		setPage(0);
	}, [statusFilter, fechaInicioStr, fechaFinStr]);

	// KPI summary calculation
	const kpis = useMemo<OperacionKpis>(() => {
		let enOperacion = 0;
		let completados = 0;
		let sinAbrir = 0;
		let totalHoras = 0;

		for (const r of filteredRecords) {
			if (r.status === 'en_operacion') enOperacion++;
			else if (r.status === 'completado') completados++;
			else if (r.status === 'sin_abrir') sinAbrir++;
			totalHoras += r.operative_time;
		}

		return {
			totalRegistros: filteredRecords.length,
			enOperacion,
			completados,
			sinAbrir,
			totalHoras: Math.round(totalHoras * 100) / 100,
		};
	}, [filteredRecords]);

	// Pagination slicing
	const totalPages = Math.max(
		1,
		Math.ceil(filteredRecords.length / rowsPerPage),
	);
	const paginatedRecords = useMemo(() => {
		const start = page * rowsPerPage;
		return filteredRecords.slice(start, start + rowsPerPage);
	}, [filteredRecords, page, rowsPerPage]);

	return {
		fechaInicio,
		setFechaInicio,
		fechaFin,
		setFechaFin,
		statusFilter,
		setStatusFilter,
		page,
		setPage,
		rowsPerPage,
		setRowsPerPage,
		loading,
		refetch,
		kpis,
		filteredRecords,
		paginatedRecords,
		totalPages,
	};
}
