import { createContext, useContext, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import type { HorariosAcceso } from '../interfaces/acceso';
import type { TiendaSeleccionada } from '../interfaces/tiendas';
import {
	type Rol,
	SECCIONES,
	type Seccion,
	type SubSeccion,
} from '../navigation/secciones';
import { useHorariosAcceso } from './useHorariosAcceso';
import {
	type SeccionActiva,
	useIrA,
	useSeccionActiva,
} from './useSeccionActiva';
import { useTiendaSeleccionada } from './useTiendaSeleccionada';

export interface HorariosLayoutValue extends SeccionActiva {
	acceso: HorariosAcceso;
	tienda: TiendaSeleccionada;
	seccionesVisibles: readonly Seccion[];
	irA: ReturnType<typeof useIrA>;
}

export const HorariosLayoutContext = createContext<HorariosLayoutValue | null>(
	null,
);

export function accesoDeSubseccion(
	acceso: HorariosAcceso,
	subseccion: SubSeccion | null,
): HorariosAcceso {
	if (
		!subseccion?.roles?.includes('comercial') ||
		!acceso.roles.has('comercial')
	)
		return acceso;
	const roles = new Set<Rol>(acceso.roles);
	roles.delete('tienda'); // si no, useTiendaSeleccionada fija la tienda propia
	return {
		...acceso,
		roles,
		rolPrincipal: 'comercial',
		tiendasPermitidas: acceso.tiendasComercial,
	};
}

/**
 * Estado del layout. Solo lo llama `HorariosLayout`; el resto de componentes
 * usa `useHorariosLayout()` para leerlo del contexto.
 */
export function useHorariosLayoutState(): HorariosLayoutValue {
	const { user } = useAuth();
	const accesoBase = useHorariosAcceso();
	const { seccion, subseccion } = useSeccionActiva();
	const acceso = useMemo(
		() => accesoDeSubseccion(accesoBase, subseccion),
		[accesoBase, subseccion],
	);
	const irA = useIrA();
	const tienda = useTiendaSeleccionada(
		acceso,
		seccion?.tienda ?? 'ninguno',
		user?.store_name,
	);

	// Las pestañas salen del acceso base: no cambian al entrar a una sub‑sección.
	const { puede } = accesoBase;
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
