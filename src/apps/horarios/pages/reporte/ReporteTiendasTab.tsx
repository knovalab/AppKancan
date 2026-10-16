import { Box } from '@mui/material';
import {
	ReporteTiendasHeader,
	ReporteTiendasKpis,
	ReporteTiendasPagination,
	ReporteTiendasTable,
} from '../../components/com_time_record_store';
import { useReporteTiendas } from '../../hooks/useReporteTiendas';
import type { RegistroTienda } from '../../interfaces/registroTienda';

export interface ReporteTiendasTabProps {
	registrosTienda: RegistroTienda[];
	loading?: boolean;
	onExportExcel?: () => void;
	searchNombre?: string;
}

export default function ReporteTiendasTab({
	registrosTienda,
	loading = false,
	onExportExcel,
	searchNombre = '',
}: ReporteTiendasTabProps) {
	const {
		page,
		setPage,
		rowsPerPage,
		setRowsPerPage,
		filteredRecords,
		paginatedData,
		totalPages,
		stats,
	} = useReporteTiendas({
		registrosTienda,
		searchNombre,
	});

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: 2 }}>
			{/* KPI Summary Cards */}
			<ReporteTiendasKpis stats={stats} />

			{/* Sub-header / Actions */}
			<ReporteTiendasHeader
				totalRecords={filteredRecords.length}
				onExportExcel={onExportExcel}
			/>

			{/* Table */}
			<ReporteTiendasTable records={paginatedData} loading={loading} />

			{/* Pagination controls */}
			<ReporteTiendasPagination
				page={page}
				totalPages={totalPages}
				rowsPerPage={rowsPerPage}
				totalRecords={filteredRecords.length}
				onPageChange={setPage}
				onRowsPerPageChange={setRowsPerPage}
			/>
		</Box>
	);
}
