import dayjs from 'dayjs';
import { validarHoraExtra } from './reglas';

/** Tope de líneas por lote: una petición razonable y una revisión humana posible. */
export const MAX_LINEAS_LOTE = 200;

/** Máximo de días (columnas) de la grilla de registro. */
export const MAX_DIAS_GRILLA = 5;

/** Una hora extra por crear: un empleado en un día. */
export interface LineaHoraExtra {
	/** Estable mientras se edita (no cambia al mover fecha u horas). */
	clave: string;
	empleadoId: string;
	/** YYYY-MM-DD */
	fecha: string;
	minutos: number;
}

/** Días de `desde` a `hasta`, ambos incluidos; vacío si el rango no es válido. */
export function diasDelRango(desde: string, hasta: string): string[] {
	const fin = dayjs(hasta);
	if (!dayjs(desde).isValid() || !fin.isValid() || hasta < desde) return [];
	const dias: string[] = [];
	for (let d = dayjs(desde); !d.isAfter(fin); d = d.add(1, 'day'))
		dias.push(d.format('YYYY-MM-DD'));
	return dias;
}

/** Clave persona + día, para cruzar con lo ya registrado. */
export const claveDia = (empleadoId: string | number, fecha: string) =>
	`${empleadoId}|${fecha}`;

export interface ErrorLinea {
	campo: 'fecha' | 'minutos';
	mensaje: string;
}

/**
 * Error de cada línea (por `clave`); vacío si todas son válidas. Reutiliza
 * `validarHoraExtra` (fecha no futura, bloques de 30 min) y marca la misma
 * persona + día repetida dentro del lote.
 */
export function validarLineas(
	lineas: readonly LineaHoraExtra[],
	hoy: string,
): Map<string, ErrorLinea> {
	const errores = new Map<string, ErrorLinea>();
	const vistas = new Map<string, number>();
	for (const l of lineas) {
		const k = claveDia(l.empleadoId, l.fecha);
		vistas.set(k, (vistas.get(k) ?? 0) + 1);
	}
	for (const l of lineas) {
		const e = validarHoraExtra(
			{ workDate: l.fecha, minutos: l.minutos },
			{ hoy, empleadoActivo: true, empleadoDelLider: true },
		);
		const repetida = (vistas.get(claveDia(l.empleadoId, l.fecha)) ?? 0) > 1;
		if (e.workDate)
			errores.set(l.clave, { campo: 'fecha', mensaje: e.workDate });
		else if (e.minutos)
			errores.set(l.clave, { campo: 'minutos', mensaje: e.minutos });
		else if (repetida)
			errores.set(l.clave, {
				campo: 'fecha',
				mensaje: 'Repetida: misma persona y día en este lote',
			});
	}
	return errores;
}

/** Error del rango de la grilla, o `null` si es válido (no futuro, máximo 5 días). */
export function validarRangoGrilla(
	desde: string,
	hasta: string,
	hoy: string,
): string | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))
		return 'Elige el rango de fechas';
	if (hasta < desde) return 'La fecha final no puede ser anterior a la inicial';
	if (hasta > hoy) return 'No se pueden registrar horas extras de días futuros';
	if (diasDelRango(desde, hasta).length > MAX_DIAS_GRILLA)
		return `El rango admite máximo ${MAX_DIAS_GRILLA} días`;
	return null;
}

/**
 * Celdas de la grilla (`claveDia` → minutos) a líneas. Solo cuentan las celdas
 * con valor, de los días del rango y de las personas indicadas.
 */
export function lineasDeCeldas(
	celdas: ReadonlyMap<string, number>,
	dias: readonly string[],
	empleadoIds: readonly string[],
): LineaHoraExtra[] {
	const lineas: LineaHoraExtra[] = [];
	for (const empleadoId of empleadoIds)
		for (const fecha of dias) {
			const clave = claveDia(empleadoId, fecha);
			const minutos = celdas.get(clave);
			if (minutos) lineas.push({ clave, empleadoId, fecha, minutos });
		}
	return lineas;
}
