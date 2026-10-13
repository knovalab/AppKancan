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
	console.log('useAceptacionNormasEmpleados', empleadoIds);
	console.log('cuando');
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

	return { normas, puedeAceptar: temporal, yaAcepto, marcarAceptado };
}
