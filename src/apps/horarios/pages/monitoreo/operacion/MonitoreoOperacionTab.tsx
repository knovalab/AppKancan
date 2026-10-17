import { Box } from '@mui/material';
import type { Tienda } from '../../../interfaces/tiendas';
import { exportarRegistroTiendaExcel } from '../../../utils/exportarRegistroTienda';
import { Paginador } from '../MonitoreoComponents';
import { MonitoreoOperacionFiltros } from './components/MonitoreoOperacionFiltros';
import { MonitoreoOperacionKpis } from './components/MonitoreoOperacionKpis';
import { MonitoreoOperacionTable } from './components/MonitoreoOperacionTable';
import { useMonitoreoOperacionTiendas } from './hooks/useMonitoreoOperacionTiendas';

export interface MonitoreoOperacionTabProps {
	tiendas: Tienda[];
}

export default function MonitoreoOperacionTab({
	tiendas,
}: MonitoreoOperacionTabProps) {
	const {
		fechaInicio,
		setFechaInicio,
		fechaFin,
		setFechaFin,
		statusFilter,
		setStatusFilter,
		page,
		setPage,
		loading,
		kpis,
		filteredRecords,
		paginatedRecords,
		totalPages,
	} = useMonitoreoOperacionTiendas({ tiendas });

	const handleExportExcel = () => {
		if (filteredRecords.length === 0) return;
		exportarRegistroTiendaExcel({
			registros: filteredRecords,
			nombreArchivo: `monitoreo_operacion_tiendas_${new Date().toISOString().slice(0, 10)}.xlsx`,
		});
	};

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
			<MonitoreoOperacionKpis kpis={kpis} />

			<MonitoreoOperacionFiltros
				fechaInicio={fechaInicio}
				fechaFin={fechaFin}
				onFechaChange={(inicio, fin) => {
					setFechaInicio(inicio);
					setFechaFin(fin);
				}}
				statusFilter={statusFilter}
				onStatusFilterChange={setStatusFilter}
				onExportExcel={handleExportExcel}
			/>

			<Box>
				<MonitoreoOperacionTable records={paginatedRecords} loading={loading} />
				<Paginador
					count={totalPages}
					page={page}
					setPage={setPage}
					label="jornadas de tienda"
					total={filteredRecords.length}
				/>
			</Box>
		</Box>
	);
}
