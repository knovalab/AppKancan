import { ESTADO, type EstadoAsistencia } from './estados';
import { MARCACIONES, type Marcacion } from './marcaciones';
import type { RegistrosAsistencia } from './modelo';

/** El estado es el que deja la última marcación registrada, en orden de jornada. */
export function calcularEstado(
	registros: RegistrosAsistencia,
): EstadoAsistencia {
	for (let i = MARCACIONES.length - 1; i >= 0; i--) {
		const m = MARCACIONES[i];
		if (registros[m.key]) return m.estadoResultante;
	}
	return ESTADO.entradaPendiente;
}

/** ¿Ya existe esta marcación en los registros del día? */
export function yaRegistrada(
	registros: RegistrosAsistencia,
	marcacion: Pick<Marcacion, 'key'>,
): boolean {
	return registros.ids[marcacion.key] != null || !!registros[marcacion.key];
}
