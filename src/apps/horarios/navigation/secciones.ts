import type { SvgIconComponent } from '@mui/icons-material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GridViewIcon from '@mui/icons-material/GridView';
import HistoryIcon from '@mui/icons-material/History';
import MoreTimeIcon from '@mui/icons-material/MoreTime';

export const BASE = '/horarios';

export type Rol = 'tienda' | 'admin' | 'areaManager' | 'report';

export type ModoTienda =
	| 'ninguno' // no se muestra
	| 'una' // exige una tienda concreta
	| 'una-o-todas'; // permite "Todas las tiendas"

export interface SubSeccion {
	path: string;
	label: string;
	roles?: readonly Rol[];
}

export interface Seccion {
	path: string;
	label: string;
	titulo: string;
	subtitulo: string;
	icon: SvgIconComponent;
	roles: readonly Rol[];
	tienda: ModoTienda;
	habilitada?: boolean;
	mostrarNormas?: boolean;
	selectorEnHeader?: boolean;
	mostrarTutorial?: boolean;
	subsecciones?: readonly SubSeccion[];
}

export const SECCIONES: readonly Seccion[] = [
	{
		path: 'registros',
		label: 'REGISTROS',
		titulo: 'Panel de Asistencia',
		subtitulo: 'Gestiona las marcaciones de asistencia del día',
		icon: EventNoteIcon,
		roles: ['tienda', 'admin'],
		tienda: 'una',
		mostrarTutorial: true,
	},
	{
		path: 'novedades',
		label: 'NOVEDADES',
		titulo: 'Registro de Novedades',
		subtitulo: 'Gestiona y revisa las incidencias de asistencia en tiempo real',
		icon: AssignmentIcon,
		roles: ['tienda', 'admin'],
		tienda: 'una',
		mostrarTutorial: true,
	},
	{
		path: 'historial',
		label: 'HISTORIAL',
		titulo: 'Historial',
		subtitulo:
			'Consulta y verifica los registros históricos de la jornada laboral',
		icon: HistoryIcon,
		roles: ['tienda', 'admin'],
		tienda: 'una-o-todas',
		mostrarTutorial: true,
	},
	{
		path: 'malla',
		label: 'MALLA',
		titulo: 'Malla Horaria',
		subtitulo: 'Visualiza la planificación de turnos y horarios',
		icon: GridViewIcon,
		roles: ['tienda', 'admin'],
		tienda: 'una',
		habilitada: false,
	},
	{
		path: 'monitoreo',
		label: 'MONITOREO',
		titulo: 'Monitoreo',
		subtitulo: 'Resumen de asistencia y auditoría de ediciones por tienda',
		icon: AnalyticsIcon,
		roles: ['admin', 'areaManager'],
		tienda: 'una-o-todas',
		subsecciones: [
			{ path: 'resumen', label: 'Resumen de Asistencia' },
			{ path: 'auditoria', label: 'Auditoría de Ediciones Manuales' },
			{
				path: 'control-horas',
				label: 'Control de Horas',
				roles: ['areaManager'],
			},
			{
				path: 'editar-registros',
				label: 'Editar registros',
				roles: ['areaManager'],
			},
		],
	},
	{
		path: 'reportes',
		label: 'REPORTE',
		titulo: 'Reporte de Asistencia',
		subtitulo: 'Exporta informes y visualiza registros detallados',
		icon: FileDownloadIcon,
		roles: ['report', 'areaManager'],
		tienda: 'una-o-todas',
		selectorEnHeader: false,
		subsecciones: [
			{ path: 'marcaciones', label: 'Marcaciones' },
			{ path: 'novedades', label: 'Novedades' },
			{ path: 'pausas', label: 'Pausas activas' },
			{ path: 'semanal', label: 'Semanal' },
		],
	},
	{
		path: 'horas-extras',
		label: 'HORAS EXTRAS',
		titulo: 'Horas Extras',
		subtitulo: 'Registra y consulta las horas extras de tus tiendas',
		icon: MoreTimeIcon,
		roles: ['areaManager'],
		tienda: 'una-o-todas',
		mostrarNormas: false,
		subsecciones: [{ path: 'registradas', label: 'Registradas' }],
	},
	{
		path: 'admin',
		label: 'ADMIN',
		titulo: 'Panel Administrativo',
		subtitulo: 'Gestión de empleados de todas las tiendas',
		icon: AdminPanelSettingsIcon,
		roles: ['admin'],
		tienda: 'ninguno',
		mostrarNormas: false,
	},
];

/** Sección a la que se envía a cada rol al entrar a /horarios o a una ruta no permitida. */
export const INICIO_POR_ROL: Record<Rol, string> = {
	admin: 'registros',
	areaManager: 'monitoreo',
	tienda: 'registros',
	report: 'reportes',
};

/** Orden de prioridad para decidir el rol principal cuando hay varios. */
export const PRIORIDAD_ROL: readonly Rol[] = [
	'admin',
	'areaManager',
	'tienda',
	'report',
];

export const buscarSeccion = (path: string | undefined): Seccion | null =>
	SECCIONES.find((s) => s.path === path) ?? null;
