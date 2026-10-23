import { Box, Tab, Tabs } from '@mui/material';
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import LoadingSpinner from '@/shared/components/LoadingSpinner';
import { useHorariosLayout } from '../hooks/useHorariosLayout';
import { buscarSeccion, puedeVerSubseccion } from '../navigation/secciones';

/**
 * Layout genérico para secciones con sub‑pestañas (Monitoreo, Reportes).
 * Las sub‑pestañas salen de `SECCIONES[seccion].subsecciones`, filtradas por rol.
 */
export default function SubSeccionLayout({
	seccion: path,
}: {
	seccion: string;
}) {
	const { acceso, subseccion, irA } = useHorariosLayout();
	const seccion = buscarSeccion(path);
	const visibles = (seccion?.subsecciones ?? []).filter(
		(s) => seccion != null && puedeVerSubseccion(acceso, seccion, s),
	);
	const activa = visibles.some((s) => s.path === subseccion?.path)
		? subseccion?.path
		: false;

	return (
		<Box sx={{ pb: 2 }}>
			{visibles.length > 1 && (
				<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
					<Tabs
						value={activa}
						onChange={(_, sub: string) => irA(`${path}/${sub}`)}
						variant="scrollable"
						scrollButtons="auto"
						textColor="primary"
						indicatorColor="primary"
					>
						{visibles.map((s) => (
							<Tab
								key={s.path}
								value={s.path}
								label={s.label}
								sx={{ fontWeight: 700, textTransform: 'none' }}
							/>
						))}
					</Tabs>
				</Box>
			)}
			<Suspense fallback={<LoadingSpinner />}>
				<Outlet />
			</Suspense>
		</Box>
	);
}
