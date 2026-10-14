import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
	getEmpleadosQueAceptaronNormas,
	getNormasActivas,
	type Normas,
} from '../api/directus/rules';
import { esEmpleadoDemo } from '../domain/registro';
import useHorariosPolicies from './useHorariosPolicies';

/**
 * Aceptación de normas de todos los empleados de la tienda en una sola consulta.
 * Sustituye a la query por tarjeta de EmployeeCard (N+1).
 *
 * Solo consulta si el usuario tiene la política `temporal`: es el único que ve
 * el botón "Aceptar normas". Mientras carga, o si la query está deshabilitada,
 * `yaAcepto` devuelve true para no mostrar el botón ni el modal por error.
 */
export function useAceptacionNormasEmpleados(empleadoIds: readonly string[]) {
	const queryClient = useQueryClient();
	const { tieneTemporal } = useHorariosPolicies();
	const temporal = tieneTemporal();

	const { data: normas = null } = useQuery<Normas | null>({
		queryKey: ['normasActivas'],
		queryFn: getNormasActivas,
		staleTime: 10 * 60 * 1000,
	});

	// Ordenados y sin duplicados: la clave de caché no depende del orden de la lista.
	const ids = useMemo(
		() =>
			[...new Set(empleadoIds)]
				.filter((id) => !esEmpleadoDemo(id))
				.map(Number)
				.filter((id) => Number.isFinite(id))
				.sort((a, b) => a - b),
		[empleadoIds],
	);

	const queryKey = useMemo(
		() => ['aceptacionNormasEmpleados', normas?.id, normas?.version, ids],
		[normas?.id, normas?.version, ids],
	);

	const { data: aceptaron } = useQuery<Set<number>>({
		queryKey,
		queryFn: () => {
			if (!normas) return new Set<number>();
			return getEmpleadosQueAceptaronNormas(ids, normas.id, normas.version);
		},
		enabled: !!normas && ids.length > 0 && temporal,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 1,
	});

	const yaAcepto = useCallback(
		(empleadoId: string) =>
			esEmpleadoDemo(empleadoId) ||
			!aceptaron ||
			aceptaron.has(Number(empleadoId)),
		[aceptaron],
	);

	// Tras registrar la aceptación se actualiza la caché sin volver a consultar.
	const marcarAceptado = useCallback(
		(empleadoId: string) => {
			queryClient.setQueryData<Set<number>>(queryKey, (prev) => {
				const next = new Set(prev);
				next.add(Number(empleadoId));
				return next;
			});
		},
		[queryClient, queryKey],
	);

	// Consulta fresca a Directus para un empleado, sin caché ni la condición `temporal`:
	// la usa "Comenzar Jornada" para decidir si abre el modal de normas (como antes de ce3316d).
	// Ante error asume que aceptó, para no bloquear por la red.
	const verificarAceptacion = useCallback(
		async (empleadoId: string): Promise<boolean> => {
			if (!normas || esEmpleadoDemo(empleadoId)) return true;
			const idNum = Number(empleadoId);
			try {
				const aceptaronAhora = await getEmpleadosQueAceptaronNormas(
					[idNum],
					normas.id,
					normas.version,
				);
				const acepto = aceptaronAhora.has(idNum);
				// Sincroniza la caché de la tienda (si existe) para que el botón refleje el dato real.
				queryClient.setQueryData<Set<number>>(queryKey, (prev) => {
					if (!prev || prev.has(idNum) === acepto) return prev;
					const next = new Set(prev);
					if (acepto) next.add(idNum);
					else next.delete(idNum);
					return next;
				});
				return acepto;
			} catch (error) {
				console.error(
					'❌ Error verificando aceptación de normas del empleado:',
					error,
				);
				return true;
			}
		},
		[normas, queryClient, queryKey],
	);

	return {
		normas,
		puedeAceptar: temporal,
		yaAcepto,
		marcarAceptado,
		verificarAceptacion,
	};
}
