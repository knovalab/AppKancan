import AssessmentIcon from '@mui/icons-material/Assessment';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import { Box, Tab, Tabs } from '@mui/material';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import type { Rol } from '../../navigation/secciones';
import ReportePage from '../ReportePage';

const ReporteHorasExtrasTab = lazy(
	() => import('../reporte/ReporteHorasExtrasTab'),
);

/**
 * Quién ve cada vista de Reportes. Gerencia = comercial. Sin `report`: todo jefe de
 * zona lo tiene (`esReport`) y su reporte de horas extras llega en otra fase (R2).
 */
const VISTAS = [
	{
		id: 'asistencia',
		label: 'Asistencia',
		icon: <AssessmentIcon />,
		roles: ['report', 'areaManager'],
	},
	{
		id: 'horas-extras',
		label: 'Horas extras',
		icon: <MoreTimeIcon />,
		roles: ['comercial', 'nomina'],
	},
] as const satisfies readonly {
	id: string;
	label: string;
	icon: JSX.Element;
	roles: readonly Rol[];
}[];

type Vista = (typeof VISTAS)[number]['id'];

/**
 * Sección "Reportes" (/horarios/reportes). Dos vistas, según el rol, en `?vista=`:
 * - **Asistencia**: `ReportePage`, igual que antes (tiene su propio selector de tienda,
 *   por eso `selectorEnHeader: false`; la selección se guarda en `?tienda=` vía el layout).
 * - **Horas extras**: reporte por periodo y empresa.
 */
export default function ReportesSeccion() {
	const { tienda, acceso } = useHorariosLayout();
	const [params, setParams] = useSearchParams();
	const esAreaManager = acceso.roles.has('areaManager');

	const visibles = VISTAS.filter((v) => acceso.puede(v.roles));
	const pedida = params.get('vista') as Vista | null;
	const vista: Vista =
		visibles.find((v) => v.id === pedida)?.id ??
		visibles[0]?.id ??
		'asistencia';

	return (
		<>
			{visibles.length > 1 && (
				<Box sx={{ mb: 2, borderBottom: '1px solid #e2e8f0' }}>
					<Tabs
						value={vista}
						onChange={(_, v: Vista) =>
							setParams(
								(prev) => {
									const sig = new URLSearchParams(prev);
									sig.set('vista', v);
									return sig;
								},
								{ replace: true },
							)
						}
						aria-label="Tipo de reporte"
					>
						{visibles.map((v) => (
							<Tab
								key={v.id}
								value={v.id}
								label={v.label}
								icon={v.icon}
								iconPosition="start"
							/>
						))}
					</Tabs>
				</Box>
			)}
			{vista === 'horas-extras' ? (
				<Suspense fallback={null}>
					<ReporteHorasExtrasTab />
				</Suspense>
			) : (
				<ReportePage
					storeSel={tienda.storeId}
					onStoreChange={(id) =>
						tienda.setSeleccion(
							id == null
								? { tipo: 'todas' }
								: id === acceso.tiendaPropia
									? { tipo: 'propia' }
									: { tipo: 'una', id },
						)
					}
					// ReportePage no usa esta prop (la recibe como `novedades: _`).
					novedades={[]}
					esAdmin={acceso.roles.has('admin') || esAreaManager}
					tiendasPermitidas={
						esAreaManager ? acceso.tiendasPermitidas : undefined
					}
				/>
			)}
		</>
	);
}
