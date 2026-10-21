import { lazy, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import HorariosLayout from './layouts/HorariosLayout';
import {
	IndexRedirect,
	IndexSubseccion,
	RequireRole,
	RequireSubseccion,
} from './navigation/RequireRole';
import { buscarSeccion } from './navigation/secciones';
import RegistrosPage from './pages/RegistrosPage';

// Todas las secciones excepto Registros (landing page) se cargan bajo demanda.
// El tour (también lazy) prefetches Novedades e Historial al iniciarse.
const NovedadesSeccion = lazy(
	() => import('./pages/secciones/NovedadesSeccion'),
);
const HistorialSeccion = lazy(
	() => import('./pages/secciones/HistorialSeccion'),
);
const MonitoreoSeccion = lazy(
	() => import('./pages/secciones/MonitoreoSeccion'),
);
const ReportesSeccion = lazy(() => import('./pages/secciones/ReportesSeccion'));
const AdminSeccion = lazy(() => import('./pages/secciones/AdminSeccion'));
const HorasExtrasSeccion = lazy(
	() => import('./pages/secciones/HorasExtrasSeccion'),
);
const HorasExtrasRegistradas = lazy(
	() => import('./pages/horas-extras/RegistradasPage'),
);
const HorasExtrasHistorial = lazy(
	() => import('./pages/horas-extras/HistorialPage'),
);
const HorasExtrasAprobacion = lazy(
	() => import('./pages/horas-extras/AprobacionPage'),
);
const HorasExtrasPeriodos = lazy(
	() => import('./pages/horas-extras/PeriodosPage'),
);

// Los roles de cada ruta salen de SECCIONES (única fuente de verdad).
// routeValidator exige path|index en cada ruta: el guard envuelve el element
// en vez de usarse como ruta agrupadora sin path.
const seccion = (
	path: string,
	element: ReactNode,
	children?: RouteObject[],
): RouteObject => ({
	path,
	children,
	element: (
		<RequireRole roles={buscarSeccion(path)?.roles ?? []}>
			{element}
		</RequireRole>
	),
});

// Sub‑ruta: la protege la misma regla que decide si se ve su pestaña.
const subseccion = (
	padre: string,
	path: string,
	element: ReactNode,
): RouteObject => ({
	path,
	element: (
		<RequireSubseccion seccion={padre} path={path}>
			{element}
		</RequireSubseccion>
	),
});

const rutasHorarios: RouteObject[] = [
	{
		path: 'horarios',
		element: <HorariosLayout />,
		children: [
			{ index: true, element: <IndexRedirect /> },
			seccion('registros', <RegistrosPage />),
			seccion('novedades', <NovedadesSeccion />),
			seccion('historial', <HistorialSeccion />),
			seccion('monitoreo', <MonitoreoSeccion />),
			seccion('reportes', <ReportesSeccion />),
			seccion('admin', <AdminSeccion />),
			seccion('horas-extras', <HorasExtrasSeccion />, [
				{ index: true, element: <IndexSubseccion seccion="horas-extras" /> },
				subseccion('horas-extras', 'registradas', <HorasExtrasRegistradas />),
				subseccion('horas-extras', 'historial', <HorasExtrasHistorial />),
				subseccion('horas-extras', 'aprobacion', <HorasExtrasAprobacion />),
				subseccion('horas-extras', 'periodos', <HorasExtrasPeriodos />),
			]),
			{ path: '*', element: <IndexRedirect /> },
		],
	},
];

export default rutasHorarios;
