import { Box, CircularProgress, Typography } from '@mui/material';
import { Camera } from 'lucide-react';
import {
	MonitoreoFotosFiltros,
	MonitoreoFotosTiendaAccordion,
} from '../../components/monitoreo-fotos';
import { useMonitoreoFotos } from '../../hooks/useMonitoreoFotos';
import type { Tienda } from '../../interfaces/tiendas';

export interface MonitoreoFotosTabProps {
	tiendas: Tienda[];
}

export default function MonitoreoFotosTab({ tiendas }: MonitoreoFotosTabProps) {
	const {
		fechaInicio,
		setFechaInicio,
		fechaFin,
		setFechaFin,
		searchEmpleado,
		setSearchEmpleado,
		loading,
		storeGroups,
		totalPhotos,
	} = useMonitoreoFotos({ tiendas });

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
			<MonitoreoFotosFiltros
				fechaInicio={fechaInicio}
				fechaFin={fechaFin}
				onFechaChange={(inicio, fin) => {
					setFechaInicio(inicio);
					setFechaFin(fin);
				}}
				searchEmpleado={searchEmpleado}
				onSearchEmpleadoChange={setSearchEmpleado}
				totalPhotos={totalPhotos}
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
						Cargando fotografías de marcación...
					</Typography>
				</Box>
			) : storeGroups.length === 0 ? (
				/* Empty State when no photos exist for the selected filters */
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
						<Camera size={36} />
					</Box>
					<Typography
						variant="h6"
						sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}
					>
						No se encontraron fotografías de verificación
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460 }}>
						No hay fotos de marcaciones registradas para el rango de fechas
						seleccionado en estas tiendas, o los filtros aplicados no coinciden
						con ningún empleado.
					</Typography>
				</Box>
			) : (
				/* Render Store Accordions with Date rows inside (no mixing of stores or dates) */
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					{storeGroups.map((store) => (
						<MonitoreoFotosTiendaAccordion
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
