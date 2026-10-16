import { Box, Paper } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { lazy, Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import LoadingSpinner from '@/shared/components/LoadingSpinner';
import { HeaderActionsProvider } from '../components/HeaderActions';
import { HorariosHeader } from '../components/HorariosHeader';
import { HorariosTabs } from '../components/HorariosTabs';
import { HorariosTourProvider } from '../components/tour/HorariosTourContext';
import {
	HorariosLayoutContext,
	useHorariosLayoutState,
} from '../hooks/useHorariosLayout';
import { syncTimeWithServer } from '../utils/timeSync';

const HorariosTour = lazy(() => import('../components/tour/HorariosTour'));

// Antes lo hacía RegistrosPage al importarse. Es global (afecta a dayjs en todo el portal),
// igual que hoy; se mantiene aquí para no cambiar el formato de fechas de la app.
dayjs.locale('es');

/**
 * Layout de la app Horarios: dueño de la navegación.
 *
 * - Resuelve la sección activa desde la URL (`/horarios/:seccion/:sub`).
 * - Pinta header, pestañas por rol y selector de tienda (`?tienda=`).
 * - Expone el estado con `useHorariosLayout()` y un slot `<HeaderActions>` para cada página.
 * - No carga datos de ninguna sección: cada página pide lo suyo.
 *
 * Ver docs/ANALISIS_RUTAS_HORARIOS.md §5.
 */
export default function HorariosLayout() {
	const value = useHorariosLayoutState();

	useEffect(() => {
		syncTimeWithServer();
	}, []);

	return (
		<HorariosLayoutContext.Provider value={value}>
			<HorariosTourProvider>
				<Suspense fallback={null}>
					<HorariosTour>
						<HeaderActionsProvider>
							<Box
								sx={{
									minHeight: 'calc(100vh - 64px)',
									px: { xs: 0.5, sm: 2, md: 4 },
									pt: { xs: 0.5, sm: 1 },
									pb: 2,
								}}
							>
								<Paper
									className="tour-sticky-header"
									elevation={0}
									sx={{
										position: 'sticky',
										top: 0,
										zIndex: 10,
										borderRadius: 4,
										overflow: 'hidden',
										border: '1px solid #f0e2e2ff',
										boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
										mb: 2,
										bgcolor: '#fff',
									}}
								>
									<HorariosHeader />
									<HorariosTabs />
								</Paper>

								{value.acceso.cargando ? (
									<LoadingSpinner message="Cargando permisos..." />
								) : (
									<Suspense fallback={<LoadingSpinner />}>
										<Outlet />
									</Suspense>
								)}
							</Box>
						</HeaderActionsProvider>
					</HorariosTour>
				</Suspense>
			</HorariosTourProvider>
		</HorariosLayoutContext.Provider>
	);
}
