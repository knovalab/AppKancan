import { useCallback } from 'react';
import {
	matchPath,
	useLocation,
	useNavigate,
	useSearchParams,
} from 'react-router-dom';
import {
	BASE,
	buscarSeccion,
	type Seccion,
	type SubSeccion,
} from '../navigation/secciones';

export interface SeccionActiva {
	seccion: Seccion | null;
	subseccion: SubSeccion | null;
}

/** Resuelve la sección y sub‑sección activas a partir de la URL. */
export function useSeccionActiva(): SeccionActiva {
	const { pathname } = useLocation();
	const match = matchPath({ path: `${BASE}/:seccion/*`, end: false }, pathname);
	const seccion = buscarSeccion(match?.params.seccion);
	const subPath = match?.params['*']?.split('/')[0];
	const subseccion =
		seccion?.subsecciones?.find((s) => s.path === subPath) ?? null;
	return { seccion, subseccion };
}

/**
 * Navega dentro de la app conservando los query params compartidos
 * (`?tienda=`, `?desde=`, `?hasta=`). `path` es relativo a BASE.
 */
export function useIrA() {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	return useCallback(
		(path: string, opciones?: { replace?: boolean }) =>
			navigate(
				{ pathname: `${BASE}/${path}`, search: params.toString() },
				{ replace: opciones?.replace },
			),
		[navigate, params],
	);
}
