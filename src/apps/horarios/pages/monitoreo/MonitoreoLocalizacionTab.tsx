import { Box, CircularProgress, Typography } from '@mui/material';
import { MapPin } from 'lucide-react';
import {
	MonitoreoLocalizacionFiltros,
	MonitoreoLocalizacionTiendaAccordion,
} from '../../components/monitoreo-localizacion';
import { useMonitoreoLocalizacion } from '../../hooks/useMonitoreoLocalizacion';
import type { Tienda } from '../../interfaces/tiendas';

export interface MonitoreoLocalizacionTabProps {
	tiendas: Tienda[];
}

export default function MonitoreoLocalizacionTab({
	tiendas,
}: MonitoreoLocalizacionTabProps) {
	const {
		fechaInicio,
		setFechaInicio,
		fechaFin,
		setFechaFin,
		searchEmpleado,
		setSearchEmpleado,
		loading,
		storeGroups,
		totalRecords,
	} = useMonitoreoLocalizacion({ tiendas });

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
			{/* Filters Bar: DateRangeFilter with DateCalendar, local employee search */}
			<MonitoreoLocalizacionFiltros
				fechaInicio={fechaInicio}
				fechaFin={fechaFin}
				onFechaChange={(inicio, fin) => {
					setFechaInicio(inicio);
					setFechaFin(fin);
				}}
				searchEmpleado={searchEmpleado}
				onSearchEmpleadoChange={setSearchEmpleado}
				totalRecords={totalRecords}
			/>

			{/* Loading State */}
			{loading ? (
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						py: 8,
						gap: 2,
					}}
				>
					<CircularProgress size={36} sx={{ color: '#004680' }} />
					<Typography
						variant="body2"
						sx={{ color: '#64748b', fontWeight: 600 }}
					>
						Cargando ubicaciones de marcación...
					</Typography>
				</Box>
			) : storeGroups.length === 0 ? (
				/* Empty State when no GPS coordinates exist for the selected filters */
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						py: 10,
						px: 2,
						bgcolor: '#f8fafc',
						borderRadius: 3,
						border: '1px dashed #cbd5e1',
						textAlign: 'center',
					}}
				>
					<Box
						sx={{
							p: 2,
							borderRadius: '50%',
							bgcolor: '#f1f5f9',
							color: '#94a3b8',
							mb: 1.5,
						}}
					>
						<MapPin size={36} />
					</Box>
					<Typography
						variant="h6"
						sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}
					>
						No se encontraron ubicaciones de verificación GPS
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460 }}>
						No hay registros con geolocalización GPS para el rango de fechas
						seleccionado en estas tiendas, o los filtros aplicados no coinciden
						con ningún empleado.
					</Typography>
				</Box>
			) : (
				/* Render Store Accordions with Date rows inside (no mixing of stores or dates) */
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					{storeGroups.map((store) => (
						<MonitoreoLocalizacionTiendaAccordion
							key={store.storeId}
							storeGroup={store}
							defaultExpanded={false}
						/>
					))}
				</Box>
			)}
		</Box>
	);
}

