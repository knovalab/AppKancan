import LoadingSpinner from '@/shared/components/LoadingSpinner';
import NovedadesTab from '../../components/NovedadesTab';
import { useHorarios } from '../../hooks/useHorarios';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';

/** Sección "Novedades" (/horarios/novedades). Adaptador sobre `NovedadesTab`. */
export default function NovedadesSeccion() {
	const { tienda, acceso } = useHorariosLayout();
	const { novedades, loading } = useHorarios(tienda.storeId);

	if (loading) return <LoadingSpinner />;

	return (
		<NovedadesTab
			novedades={novedades}
			esAdmin={acceso.roles.has('admin')}
			storeOverride={tienda.storeId ?? undefined}
		/>
	);
}
