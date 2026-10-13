import { lazy, type ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import HorariosLayout from './layouts/HorariosLayout';
import { IndexRedirect, RequireRole } from './navigation/RequireRole';
import { buscarSeccion } from './navigation/secciones';
import RegistrosPage from './pages/RegistrosPage';
import HistorialSeccion from './pages/secciones/HistorialSeccion';
import NovedadesSeccion from './pages/secciones/NovedadesSeccion';

// Registros, Novedades e Historial se importan directo: el tour salta entre ellas
// y necesita que el contenido esté en el DOM al cambiar de fase.
// El resto se carga bajo demanda (el <Suspense> está en HorariosLayout).
const MonitoreoSeccion = lazy(
	() => import('./pages/secciones/MonitoreoSeccion'),
);
const ReportesSeccion = lazy(() => import('./pages/secciones/ReportesSeccion'));
const AdminSeccion = lazy(() => import('./pages/secciones/AdminSeccion'));

// Los roles de cada ruta salen de SECCIONES (única fuente de verdad).
// routeValidator exige path|index en cada ruta: el guard envuelve el element
// en vez de usarse como ruta agrupadora sin path.
const seccion = (path: string, element: ReactNode): RouteObject => ({
	path,
	element: (
		<RequireRole roles={buscarSeccion(path)?.roles ?? []}>
			{element}
		</RequireRole>
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
			{ path: '*', element: <IndexRedirect /> },
		],
	},
];

export default rutasHorarios;
