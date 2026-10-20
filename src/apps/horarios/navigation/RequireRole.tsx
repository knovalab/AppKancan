import { type PropsWithChildren, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useHorariosLayout } from '../hooks/useHorariosLayout';
import {
	BASE,
	buscarSeccion,
	puedeVerSubseccion,
	type Rol,
} from './secciones';

/**
 * Guard declarativo (el router no usa loaders). Si el rol no alcanza, redirige a la
 * sección inicial del usuario. `routeValidator` exige path|index en cada ruta, por eso
 * se usa envolviendo el `element` y no como ruta agrupadora.
 */
export function RequireRole({
	roles,
	children,
}: PropsWithChildren<{ roles: readonly Rol[] }>) {
	const { acceso } = useHorariosLayout();
	if (!acceso.puede(roles)) {
		return <Navigate to={`${BASE}/${acceso.inicio}`} replace />;
	}
	return <>{children}</>;
}

/** Redirect de `/horarios` y de rutas desconocidas a la sección inicial del rol. */
export function IndexRedirect() {
	const { acceso } = useHorariosLayout();
	return <Navigate to={`${BASE}/${acceso.inicio}`} replace />;
}

/**
 * Índice de una sección con sub‑rutas: va a la primera sub‑sección que el rol
 * puede ver (un `<Navigate to="x">` fijo haría un bucle si el rol no ve "x").
 * Usa `irA` para conservar `?tienda=`.
 */
export function IndexSubseccion({ seccion }: { seccion: string }) {
	const { acceso, irA } = useHorariosLayout();
	const sec = buscarSeccion(seccion);
	const primera = sec?.subsecciones?.find((s) =>
		puedeVerSubseccion(acceso, sec, s),
	);
	const destino = primera ? `${seccion}/${primera.path}` : acceso.inicio;
	useEffect(() => {
		irA(destino, { replace: true });
	}, [irA, destino]);
	return null;
}

/** Guard de una sub‑ruta: misma regla que las sub‑pestañas (`puedeVerSubseccion`). */
export function RequireSubseccion({
	seccion,
	path,
	children,
}: PropsWithChildren<{ seccion: string; path: string }>) {
	const { acceso } = useHorariosLayout();
	const sec = buscarSeccion(seccion);
	const sub = sec?.subsecciones?.find((s) => s.path === path);
	if (!sec || !sub || !puedeVerSubseccion(acceso, sec, sub)) {
		return <Navigate to={`${BASE}/${acceso.inicio}`} replace />;
	}
	return <>{children}</>;
}
