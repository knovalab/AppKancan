import { MARCACIONES } from './marcaciones';
import type { RegistrosAsistencia } from './modelo';

/** `RegistrosAsistencia` sin ninguna marcación (las 4 horas en null). */
export function crearRegistrosVacios(): RegistrosAsistencia {
	const horas = Object.fromEntries(
		MARCACIONES.map((m) => [m.key, null]),
	) as Record<(typeof MARCACIONES)[number]['key'], null>;
	return {
		...horas,
		observaciones: {},
		ids: {},
		horasOriginales: {},
		horasEditadas: {},
	};
}
