import { idRelacion } from '../api/directus/relacion';
import type { OverTimeDto } from '../interfaces/api/overTime';
import type { HoraExtraFila } from '../interfaces/horasExtras';
import { formatDocumentNumber, formatNombrePropio } from './format';

type ConNombre = { first_name?: string | null; last_name?: string | null };

const objeto = <T,>(v: unknown): T | null =>
	v != null && typeof v === 'object' ? (v as T) : null;

const nombre = (v: unknown): string => {
	const o = objeto<ConNombre>(v);
	return o
		? formatNombrePropio([o.first_name, o.last_name].filter(Boolean).join(' '))
		: '';
};

const periodoDe = (v: unknown): HoraExtraFila['periodo'] => {
	const id = idRelacion(v);
	if (id == null) return null;
	const o = objeto<{ start_date?: string; end_date?: string }>(v);
	return { id, inicio: o?.start_date ?? '', fin: o?.end_date ?? '' };
};

/** DTO de `com_over_time` → fila de la tabla. */
export function aFilaHoraExtra(
	dto: OverTimeDto,
): HoraExtraFila {
	const empleado = objeto<ConNombre & { document_number?: string | number | null; store_id?: unknown }>(
		dto.employee_id,
	);
	const tiendaId = idRelacion(dto.store_id);
	const tiendaEmpleado = idRelacion(empleado?.store_id);
	return {
		id: dto.id,
		fecha: dto.work_date,
		empleadoId: idRelacion(dto.employee_id),
		empleado: nombre(empleado) || `Empleado ${idRelacion(dto.employee_id) ?? ''}`.trim(),
		documento: formatDocumentNumber(empleado?.document_number ?? ''),
		tiendaId,
		tienda: objeto<{ name?: string | null }>(dto.store_id)?.name ?? '',
		rotacion: tiendaId != null && tiendaEmpleado != null && tiendaId !== tiendaEmpleado,
		minutos: dto.minutes,
		observacion: dto.observations ?? '',
		estado: dto.status,
		creadaPor: nombre(dto.created_by),
		creadaEl: dto.created_at ?? '',
		periodo: periodoDe(dto.period_id),
	};
}
