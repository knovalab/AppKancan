import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useHorariosLayout } from '../hooks/useHorariosLayout';
import { BASE, type Rol } from './secciones';

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
