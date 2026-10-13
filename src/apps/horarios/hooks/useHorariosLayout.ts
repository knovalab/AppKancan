import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { SECCIONES, type Seccion } from '../navigation/secciones';
import { type HorariosAcceso, useHorariosAcceso } from './useHorariosAcceso';
import {
	type SeccionActiva,
	useIrA,
	useSeccionActiva,
} from './useSeccionActiva';
import {
	type TiendaSeleccionada,
	useTiendaSeleccionada,
} from './useTiendaSeleccionada';

export interface HorariosLayoutValue extends SeccionActiva {
	acceso: HorariosAcceso;
	tienda: TiendaSeleccionada;
	/** Secciones con pestaña para el usuario actual (habilitadas y permitidas). */
	seccionesVisibles: readonly Seccion[];
	/** Navega a una sección/sub‑sección (relativa a /horarios) conservando ?tienda=. */
	irA: ReturnType<typeof useIrA>;
}

export const HorariosLayoutContext = createContext<HorariosLayoutValue | null>(
	null,
);

/**
 * Estado del layout. Solo lo llama `HorariosLayout`; el resto de componentes
 * usa `useHorariosLayout()` para leerlo del contexto.
 */
export function useHorariosLayoutState(): HorariosLayoutValue {
	const { user } = useAuth();
	const acceso = useHorariosAcceso();
	const { seccion, subseccion } = useSeccionActiva();
	const irA = useIrA();
	const tienda = useTiendaSeleccionada(
		acceso,
		seccion?.tienda ?? 'ninguno',
		user?.store_name,
	);

	const { puede } = acceso;
	const seccionesVisibles = useMemo(
		() => SECCIONES.filter((s) => s.habilitada !== false && puede(s.roles)),
		[puede],
	);

	return useMemo(
		() => ({ acceso, tienda, seccion, subseccion, seccionesVisibles, irA }),
		[acceso, tienda, seccion, subseccion, seccionesVisibles, irA],
	);
}

/** Acceso al estado del layout desde cualquier página o componente hijo. */
export function useHorariosLayout(): HorariosLayoutValue {
	const ctx = useContext(HorariosLayoutContext);
	if (!ctx) {
		throw new Error('useHorariosLayout debe usarse dentro de <HorariosLayout>');
	}
	return ctx;
}
