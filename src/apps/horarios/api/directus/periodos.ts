import {
	aggregate,
	createItem,
	readItems,
	updateItem,
	updateItems,
} from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import { ESTADO_PERIODO, validarPeriodo } from '../../domain/horasExtras';
import type { CreatePeriodDto, PeriodDto } from '../../interfaces/api/period';
import { errorDeApi } from '../../utils/errores';
import { STORE_PRUEBAS } from './read';

const CAMPOS = [
	'*',
	'updated_by.id',
	'updated_by.first_name',
	'updated_by.last_name',
];

/**
 * Periodos con solo sus datos (sin `updated_by`): para reportes de quien no lee
 * usuarios, como gerencia (`time_log_gerencia`).
 */
export async function listarPeriodosResumen(): Promise<PeriodDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_period', {
					fields: [
						'id',
						'name',
						'start_date',
						'end_date',
						'status',
						'liquidacion_at',
					],
					sort: ['-start_date'],
					limit: -1,
				}),
			),
		)) as PeriodDto[];
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando periodos',
			'Error al cargar los periodos',
		);
	}
}

export async function listarPeriodos(): Promise<PeriodDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_period', {
					fields: CAMPOS,
					sort: ['-start_date'],
					limit: -1,
				}),
			),
		)) as PeriodDto[];
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando periodos',
			'Error al cargar los periodos',
		);
	}
}

export interface TotalesPeriodo {
	horas: number;
	minutos: number;
}

/** Horas y minutos vinculados por periodo, agregados en Directus (sin la tienda de pruebas). */
export async function totalesVinculados(): Promise<
	Map<number, TotalesPeriodo>
> {
	try {
		const filas = (await withAutoRefresh(() =>
			directus.request(
				aggregate('com_over_time', {
					aggregate: { count: ['id'], sum: ['minutes'] },
					groupBy: ['period_id'],
					query: {
						filter: {
							_and: [
								{ period_id: { _nnull: true } },
								{ store_id: { _neq: STORE_PRUEBAS } },
							],
						},
					},
				}),
			),
		)) as {
			period_id: number | string;
			count: { id: number | string };
			sum: { minutes: number | string | null };
		}[];
		// Directus devuelve los agregados como texto en algunos motores.
		return new Map(
			filas.map((f) => [
				Number(f.period_id),
				{ horas: Number(f.count.id), minutos: Number(f.sum.minutes ?? 0) },
			]),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando totales de periodos',
			'Error al cargar los totales de los periodos',
		);
	}
}

/**
 * Crea un periodo en `preliquidado`. Relee los periodos justo antes para que la
 * regla "sin huecos ni cruces" se compruebe contra lo último guardado.
 */
export async function crearPeriodo(data: CreatePeriodDto) {
	const nombre = data.name?.trim() ?? '';
	const errores = validarPeriodo(
		{ inicio: data.start_date, fin: data.end_date, nombre },
		await listarPeriodos(),
	);
	const mensaje = errores.inicio ?? errores.fin ?? errores.nombre;
	if (mensaje) throw new Error(mensaje);
	try {
		return await withAutoRefresh(() =>
			directus.request(
				createItem('com_period', {
					name: nombre || null,
					start_date: data.start_date,
					end_date: data.end_date,
					status: ESTADO_PERIODO.preliquidado,
				}),
			),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error creando periodo',
			'Error al crear el periodo',
		);
	}
}

/**
 * Vincula las horas (una sola petición) y cierra el periodo. Si falla el cierre,
 * reintentar es seguro: solo se vuelven a tomar horas sin `period_id`.
 */
export async function liquidarPeriodo(periodoId: number, horasIds: number[]) {
	try {
		if (horasIds.length > 0)
			await withAutoRefresh(() =>
				directus.request(
					updateItems('com_over_time', horasIds, { period_id: periodoId }),
				),
			);
		return await withAutoRefresh(() =>
			directus.request(
				updateItem('com_period', periodoId, {
					status: ESTADO_PERIODO.liquidado,
					// shortcut: hora del dispositivo (UTC); el preset $NOW de la política de nómina la sustituye por la del servidor.
					liquidacion_at: new Date().toISOString(),
				}),
			),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error liquidando periodo',
			'Error al liquidar el periodo',
		);
	}
}
