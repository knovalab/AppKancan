import { ESTADO, type EstadoAsistencia } from './estados';

/**
 * Catálogo de marcaciones del registro de horarios: única fuente de verdad.
 *
 * - `key`: nombre del campo en `RegistrosAsistencia` (inicioJornada, …).
 * - `logType`: valor que se guarda en `com_time_records.log_type`. **No cambiarlo**:
 *   los registros existentes y los reportes dependen de este texto.
 * - `etiqueta`: texto del botón en la tarjeta.
 * - `habilitadaEn`: estado en el que la marcación es la siguiente acción.
 * - `estadoResultante`: estado del empleado cuando esta es su última marcación.
 *
 * El orden del array es el orden de la jornada.
 */
export const MARCACIONES = [
	{
		key: 'inicioJornada',
		logType: 'Comenzar Jornada',
		etiqueta: 'Comenzar Jornada',
		habilitadaEn: ESTADO.entradaPendiente,
		estadoResultante: ESTADO.jornadaIniciada,
	},
	{
		key: 'inicioAlmuerzo',
		logType: 'Iniciar Almuerzo',
		etiqueta: 'Iniciar Almuerzo',
		habilitadaEn: ESTADO.jornadaIniciada,
		estadoResultante: ESTADO.enAlmuerzo,
	},
	{
		key: 'finAlmuerzo',
		logType: 'Finalizar Almuerzo',
		etiqueta: 'Finalizar Almuerzo',
		habilitadaEn: ESTADO.enAlmuerzo,
		estadoResultante: ESTADO.regresoAlmuerzo,
	},
	{
		key: 'finJornada',
		logType: 'Terminar Jornada',
		etiqueta: 'Terminar Jornada',
		habilitadaEn: ESTADO.regresoAlmuerzo,
		estadoResultante: ESTADO.jornadaFinalizada,
	},
] as const satisfies readonly {
	key: string;
	logType: string;
	etiqueta: string;
	habilitadaEn: EstadoAsistencia;
	estadoResultante: EstadoAsistencia;
}[];

export type Marcacion = (typeof MARCACIONES)[number];
export type MarcacionKey = Marcacion['key'];
export type LogType = Marcacion['logType'];

/** Acceso por clave: `LOG_TYPE.inicioJornada` → `'Comenzar Jornada'`. */
export const LOG_TYPE = Object.fromEntries(
	MARCACIONES.map((m) => [m.key, m.logType]),
) as { [K in MarcacionKey]: Extract<Marcacion, { key: K }>['logType'] };

const POR_LOG_TYPE = new Map<string, Marcacion>(
	MARCACIONES.map((m) => [m.logType, m]),
);

/** Type guard para valores que llegan de Directus (`log_type: string`). */
export function esLogType(valor: unknown): valor is LogType {
	return typeof valor === 'string' && POR_LOG_TYPE.has(valor);
}

/** Marcación a partir del `log_type`; `undefined` si no es una de las conocidas. */
export function marcacionPorLogType(logType: string): Marcacion | undefined {
	return POR_LOG_TYPE.get(logType);
}

/** Campo de `RegistrosAsistencia` para un `log_type`; `undefined` si no es conocido. */
export function keyPorLogType(logType: string): MarcacionKey | undefined {
	return POR_LOG_TYPE.get(logType)?.key;
}
