import { createItem, readItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import type { Normas } from '../../interfaces/normas';
import { errorDeApi } from '../../utils/errores';

// Normas vigentes (la fila activa de com_rules con la mayor versión).
export async function getNormasActivas(): Promise<Normas | null> {
	try {
		const items = await withAutoRefresh(() =>
			directus.request(
				readItems('com_rules', {
					fields: ['id', 'version', 'title', 'content'],
					filter: { is_active: { _eq: true } },
					sort: ['-version'],
					limit: 1,
				}),
			),
		);
		return ((items || [])[0] as Normas) ?? null;
	} catch (error) {
		console.error('❌ Error cargando las normas:', error);
		return null;
	}
}

// Empleados (de la lista dada) que ya aceptaron las normas vigentes: una sola request
// para toda la tienda en lugar de una por tarjeta.
// El _or por version mantiene la compatibilidad con aceptaciones antiguas sin rule_id.
// Los errores se propagan para que los gestione la query (retry / isError).
const MAX_IDS_POR_REQUEST = 200;

export async function getEmpleadosQueAceptaronNormas(
	employeeIds: number[],
	ruleId: number,
	version?: number,
): Promise<Set<number>> {
	const bloques: number[][] = [];
	for (let i = 0; i < employeeIds.length; i += MAX_IDS_POR_REQUEST) {
		bloques.push(employeeIds.slice(i, i + MAX_IDS_POR_REQUEST));
	}

	const resultados = await Promise.all(
		bloques.map((ids) =>
			withAutoRefresh(() =>
				directus.request(
					readItems('com_rules_acceptance', {
						fields: ['employee_id'],
						filter: {
							_and: [
								{ employee_id: { _in: ids } },
								{
									_or: [
										{ rule_id: { _eq: ruleId } },
										...(version != null ? [{ version: { _eq: version } }] : []),
									],
								},
							],
						},
						limit: -1,
					}),
				),
			),
		),
	);

	return new Set(
		resultados
			.flat()
			.map((item) =>
				Number((item as { employee_id: number | string }).employee_id),
			),
	);
}

export async function registrarAceptacionNormasEmpleado(
	employeeId: number,
	version: number,
	ruleId: number,
) {
	try {
		return await withAutoRefresh(() =>
			directus.request(
				createItem('com_rules_acceptance', {
					employee_id: employeeId,
					version,
					rule_id: ruleId,
				}),
			),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error registrando aceptación de normas del empleado',
			'Error al guardar aceptación de normas',
		);
	}
}
