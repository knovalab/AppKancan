import type { RegistrosAsistencia } from '../../interfaces/horarios.interface';
import { keyPorLogType } from './marcaciones';
import { crearRegistrosVacios } from './registros';

/** Lo mínimo de una fila de `com_time_records` que necesita el registro. */
export interface MarcacionCruda {
	id: number;
	log_type: string;
	record_time: string | null;
	original_record_time?: string | null;
	observations?: string | null;
}

/** 'HH:mm:ss' → 'HH:mm'. */
const aHHmm = (hora: string) => hora.substring(0, 5);

/**
 * Marcaciones de un empleado en un día → `RegistrosAsistencia`.
 * Los `log_type` desconocidos se ignoran. Si hay dos del mismo tipo, gana la última.
 */
export function mapearRegistros(
	marcaciones: readonly MarcacionCruda[],
): RegistrosAsistencia {
	const registros = crearRegistrosVacios();
	for (const r of marcaciones) {
		const key = keyPorLogType(r.log_type);
		if (!key) continue;
		registros[key] = r.record_time ? aHHmm(r.record_time) : '';
		registros.observaciones[key] = r.observations || '';
		registros.ids[key] = r.id;
		registros.horasOriginales[key] = r.original_record_time
			? aHHmm(r.original_record_time)
			: null;
		registros.horasEditadas[key] =
			r.original_record_time && r.record_time ? aHHmm(r.record_time) : null;
	}
	return registros;
}

/**
 * Agrupa por id de empleado en una pasada (en vez de un `filter` por empleado).
 * Los elementos cuyo id no se puede resolver se descartan.
 */
export function agruparPorEmpleado<T>(
	items: readonly T[],
	idEmpleado: (item: T) => number | null,
): Map<number, T[]> {
	const grupos = new Map<number, T[]>();
	for (const item of items) {
		const id = idEmpleado(item);
		if (id == null) continue;
		const grupo = grupos.get(id);
		if (grupo) grupo.push(item);
		else grupos.set(id, [item]);
	}
	return grupos;
}
