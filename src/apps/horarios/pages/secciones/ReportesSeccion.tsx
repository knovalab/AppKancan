import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import ReportePage from '../ReportePage';

/**
 * Sección "Reportes" (/horarios/reportes). Adaptador sobre `ReportePage`.
 * ReportePage tiene su propio selector de tienda (por eso `selectorEnHeader: false`),
 * pero la selección se guarda en `?tienda=` a través del layout.
 */
export default function ReportesSeccion() {
	const { tienda, acceso } = useHorariosLayout();
	const esAreaManager = acceso.roles.has('areaManager');

	return (
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
			tiendasPermitidas={esAreaManager ? acceso.tiendasPermitidas : undefined}
		/>
	);
}
