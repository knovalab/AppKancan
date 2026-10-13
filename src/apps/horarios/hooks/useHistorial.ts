import { useQuery } from '@tanstack/react-query';
import {
	fetchTimeRecords,
	getStoreIdUsuarioActual,
	type TimeRecord,
} from '../api/directus/read';
import { LOG_TYPE } from '../domain/registro';
import type { HistorialRow } from '../interfaces/horarios.interface';

const agruparRegistros = (records: TimeRecord[]): HistorialRow[] => {
	const agrupado: Record<string, TimeRecord[]> = {};

	records.forEach((record) => {
		const clave = `${record.employee_id?.first_name ?? record.employee_id}-${record.record_date}`;
		if (!agrupado[clave]) agrupado[clave] = [];
		agrupado[clave].push(record);
	});

	return Object.values(agrupado).map((registros) => {
		const buscar = (tipo: string) => {
			const match = registros.find((r) => r.log_type === tipo);
			if (!match) return null;
			return match.record_time || null;
		};

		const observaciones_evento = registros
			.filter((r) => r.observations && r.observations.trim())
			.map((r) => ({
				evento: r.log_type,
				hora: r.record_time,
				observacion: r.observations!,
			}));

		return {
			fecha: registros[0].record_date,
			empleado: registros[0].employee_id
				? [
						registros[0].employee_id.first_name,
						registros[0].employee_id.middle_name,
						registros[0].employee_id.last_name,
						registros[0].employee_id.second_last_name,
					]
						.filter((n) => n && n.trim())
						.join(' ')
				: 'Sin nombre',
			documento:
				registros[0].employee_id?.document_number != null
					? String(registros[0].employee_id.document_number)
					: null,
			inicio_turno: buscar(LOG_TYPE.inicioJornada),
			inicio_almuerzo: buscar(LOG_TYPE.inicioAlmuerzo),
			fin_almuerzo: buscar(LOG_TYPE.finAlmuerzo),
			fin_turno: buscar(LOG_TYPE.finJornada),
			observaciones_evento,
			tiendaNombre:
				registros[0].store_id && typeof registros[0].store_id === 'object'
					? registros[0].store_id.name
					: '—',
		};
	});
};

export const useHistorial = (
	fechaInicio?: string,
	fechaFin?: string,
	overrideStoreId?: number | number[] | null,
) => {
	const { data: storeId = null } = useQuery<number | null>({
		queryKey: ['horariosStoreId'],
		queryFn: getStoreIdUsuarioActual,
		staleTime: 30 * 60 * 1000,
		enabled: overrideStoreId === undefined,
	});

	const activeStoreId =
		overrideStoreId !== undefined ? overrideStoreId : storeId;

	return useQuery({
		queryKey: ['historial', activeStoreId, fechaInicio, fechaFin],
		queryFn: () =>
			fetchTimeRecords(fechaInicio, fechaFin, activeStoreId ?? undefined),
		select: (data) => agruparRegistros(data),
		enabled: overrideStoreId !== undefined || storeId != null,
		staleTime: 1000 * 60 * 5,
	});
};
