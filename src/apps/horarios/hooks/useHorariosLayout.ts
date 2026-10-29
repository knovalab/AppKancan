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

const ROLES_GLOBALES: readonly Rol[] = ['comercial', 'nomina'];

export function accesoDeSubseccion(
	acceso: HorariosAcceso,
	subseccion: SubSeccion | null,
): HorariosAcceso {
	const rol = ROLES_GLOBALES.find(
		(r) => subseccion?.roles?.includes(r) && acceso.roles.has(r),
	);
	if (!rol) return acceso;
	const roles = new Set<Rol>(acceso.roles);
	roles.delete('tienda'); // si no, useTiendaSeleccionada fija la tienda propia
	return {
		...acceso,
		roles,
		rolPrincipal: rol,
		tiendasPermitidas: acceso.tiendasGlobales,
	};
}

/**
 * Textos propios de un rol si es el único de los suyos con el que se ve la sección
 * (el rol principal no sirve: nómina sin otro rol también trae `tienda`, que va antes).
 */
export function conTextosDeRol<S extends Seccion | null>(
	seccion: S,
	roles: ReadonlySet<Rol>,
): S {
	const conAcceso = seccion?.roles.filter((r) => roles.has(r)) ?? [];
	const textos =
		conAcceso.length === 1 ? seccion?.textosPorRol?.[conAcceso[0]] : undefined;
	return textos ? { ...seccion, ...textos } : seccion;
}

/**
 * Estado del layout. Solo lo llama `HorariosLayout`; el resto de componentes
 * usa `useHorariosLayout()` para leerlo del contexto.
 */
export function useHorariosLayoutState(): HorariosLayoutValue {
	const { user } = useAuth();
	const accesoBase = useHorariosAcceso();
	const activa = useSeccionActiva();
	const { subseccion } = activa;
	const { roles } = accesoBase;
	const seccion = useMemo(
		() => conTextosDeRol(activa.seccion, roles),
		[activa.seccion, roles],
	);
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
		() =>
			SECCIONES.filter((s) => s.habilitada !== false && puede(s.roles)).map(
				(s) => conTextosDeRol(s, roles),
			),
		[puede, roles],
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
