import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import HistorialPage from '../HistorialPage';

/** Sección "Historial" (/horarios/historial). Adaptador sobre `HistorialPage`. */
export default function HistorialSeccion() {
	const { tienda } = useHorariosLayout();

	// "todas" → lista explícita de tiendas permitidas (antes `null` = sin filtro).
	// Sin tienda resuelta todavía → undefined: useHistorial usa la del usuario.
	const storeIdAdmin =
		tienda.seleccion.tipo === 'todas'
			? tienda.storeIds
			: (tienda.storeId ?? undefined);

	return <HistorialPage storeIdAdmin={storeIdAdmin} />;
}
