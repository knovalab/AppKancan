import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { getStoreEventReports } from '../api/directus/read';
import type { StoreEventReportDto } from '../interfaces/api/eventReports';

export interface UseReportePausasProps {
	queryStoreId: number | number[] | null;
	rangoInicio: Dayjs | null;
	rangoFin: Dayjs | null;
	searchNombre?: string;
	enabled?: boolean;
	initialRowsPerPage?: number;
}

export function useReportePausas({
	queryStoreId,
	rangoInicio,
	rangoFin,
	searchNombre = '',
	enabled = true,
	initialRowsPerPage = 5,
}: UseReportePausasProps) {
	const [pagePausas, setPagePausas] = useState(0);
	const [rowsPerPagePausas, setRowsPerPagePausas] =
		useState(initialRowsPerPage);

	const fechaInicioStr = rangoInicio
		? rangoInicio.format('YYYY-MM-DD')
		: undefined;
	const fechaFinStr = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;

	const { data: eventReports = [], isLoading } = useQuery<
		StoreEventReportDto[]
	>({
		queryKey: [
			'storeEventReportsHistory',
			queryStoreId,
			fechaInicioStr,
			fechaFinStr,
		],
		queryFn: () =>
			getStoreEventReports(queryStoreId, fechaInicioStr, fechaFinStr),
		enabled,
		staleTime: 5 * 60 * 1000,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset page on filter changes
	useEffect(() => {
		setPagePausas(0);
	}, [queryStoreId, fechaInicioStr, fechaFinStr, searchNombre]);

	const eventReportsFiltrados = useMemo(() => {
		const query = searchNombre.toLowerCase().trim();
		if (!query) return eventReports;

		return eventReports.filter((r) => {
			const first = r.employee_id?.first_name || '';
			const middle = r.employee_id?.middle_name || '';
			const last = r.employee_id?.last_name || '';
			const second = r.employee_id?.second_last_name || '';
			const fullName = [first, middle, last, second]
				.filter(Boolean)
				.join(' ')
				.trim();
			return fullName.toLowerCase().includes(query);
		});
	}, [eventReports, searchNombre]);

	const paginatedPausas = useMemo(() => {
		const start = pagePausas * rowsPerPagePausas;
		return eventReportsFiltrados.slice(start, start + rowsPerPagePausas);
	}, [eventReportsFiltrados, pagePausas, rowsPerPagePausas]);

	const totalPagesPausas = Math.max(
		1,
		Math.ceil(eventReportsFiltrados.length / rowsPerPagePausas),
	);

	return {
		eventReportsFiltrados,
		paginatedPausas,
		pagePausas,
		setPagePausas,
		totalPagesPausas,
		rowsPerPagePausas,
		setRowsPerPagePausas,
		isLoading,
	};
}
