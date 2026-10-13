import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import MonitoreoPage from '../MonitoreoPage';

/**
 * Sección "Monitoreo" (/horarios/monitoreo). Adaptador sobre `MonitoreoPage`.
 * Las sub‑pestañas siguen internas; pasarán a sub‑rutas con SubSeccionLayout (PR 5).
 */
export default function MonitoreoSeccion() {
	const { tienda } = useHorariosLayout();
	// MonitoreoPage interpreta null como "todas las permitidas".
	return <MonitoreoPage storeId={tienda.storeId} />;
}
