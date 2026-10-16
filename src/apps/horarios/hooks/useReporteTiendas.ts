import { useEffect, useMemo, useState } from 'react';
import type { RegistroTienda } from '../interfaces/registroTienda';
import {
	calculateTiendasKPIStats,
	filterRegistrosTienda,
	type TiendasKPIStats,
} from '../utils/registroTienda';

export interface UseReporteTiendasProps {
	registrosTienda: RegistroTienda[];
	searchNombre?: string;
	initialRowsPerPage?: number;
}

export interface UseReporteTiendasReturn {
	page: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	rowsPerPage: number;
	setRowsPerPage: (rows: number) => void;
	filteredRecords: RegistroTienda[];
	paginatedData: RegistroTienda[];
	totalPages: number;
	stats: TiendasKPIStats;
}

export function useReporteTiendas({
	registrosTienda,
	searchNombre = '',
	initialRowsPerPage = 10,
}: UseReporteTiendasProps): UseReporteTiendasReturn {
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

	// Filter by search string if provided
	const filteredRecords = useMemo(
		() => filterRegistrosTienda(registrosTienda, searchNombre),
		[registrosTienda, searchNombre],
	);

	// Reset page when search term changes to prevent being on an empty out-of-range page
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset page when search query changes
	useEffect(() => {
		setPage(0);
	}, [searchNombre]);

	// KPI Metrics summary
	const stats = useMemo(
		() => calculateTiendasKPIStats(filteredRecords),
		[filteredRecords],
	);

	const totalPages = Math.max(
		1,
		Math.ceil(filteredRecords.length / rowsPerPage),
	);

	// Ensure page doesn't exceed totalPages if dataset shrinks
	useEffect(() => {
		if (page > 0 && page >= totalPages) {
			setPage(Math.max(0, totalPages - 1));
		}
	}, [totalPages, page]);

	const paginatedData = useMemo(() => {
		const start = page * rowsPerPage;
		return filteredRecords.slice(start, start + rowsPerPage);
	}, [filteredRecords, page, rowsPerPage]);

	const handleRowsPerPageChange = (newRows: number) => {
		setRowsPerPage(newRows);
		setPage(0);
	};

	return {
		page,
		setPage,
		rowsPerPage,
		setRowsPerPage: handleRowsPerPageChange,
		filteredRecords,
		paginatedData,
		totalPages,
		stats,
	};
}
