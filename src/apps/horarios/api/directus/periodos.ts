import { createItem, readItems, updateItem, updateItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import { ESTADO_PERIODO, validarPeriodo } from '../../domain/horasExtras';
import type { CreatePeriodDto, PeriodDto } from '../../interfaces/api/period';
import { errorDeApi } from '../../utils/errores';

const CAMPOS = [
	'*',
	'updated_by.id',
	'updated_by.first_name',
	'updated_by.last_name',
];

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

/**
 * Crea un periodo en `preliquidado`. Relee los periodos justo antes para que la
 * regla "sin huecos ni cruces" se compruebe contra lo último guardado.
 */
export async function crearPeriodo(data: CreatePeriodDto) {
	const errores = validarPeriodo(
		{ inicio: data.start_date, fin: data.end_date },
		await listarPeriodos(),
	);
	const mensaje = errores.inicio ?? errores.fin;
	if (mensaje) throw new Error(mensaje);
	try {
		return await withAutoRefresh(() =>
			directus.request(
				createItem('com_period', {
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
