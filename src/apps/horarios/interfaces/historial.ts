import type { PuntoGeo } from '../domain/ubicacion';

export interface ObservacionEvento {
	evento: string;
	hora: string | null;
	observacion: string;
}

export interface HistorialEventoDetalle {
	evento: string;
	hora: string | null;
	observacion?: string;
	photo?: string | null;
	location?: PuntoGeo | null;
	latitude?: number | null;
	longitude?: number | null;
	accuracy?: number | null;
}

export interface HistorialRow {
	fecha: string;
	empleado: string;
	documento?: string | null;
	inicio_turno: string | null;
	inicio_almuerzo: string | null;
	fin_almuerzo: string | null;
	fin_turno: string | null;
	observaciones_evento: ObservacionEvento[];
	eventos_detalle?: HistorialEventoDetalle[];
	tiendaNombre?: string;
}
