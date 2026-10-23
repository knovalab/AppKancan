import type { QueryClient } from '@tanstack/react-query';

// LEGACY: acciones que devolvía hooks/useHorarios.ts y que no tenían efecto o consumidores.
// Movidas en el paso 1 de results/analisis/USE_HORARIOS.md §7.
//
// - eliminarEmpleado: función vacía. EmployeeCard la llamaba tras crear una novedad;
//   el empleado ya desaparece solo porque la query de novedades se invalida
//   (idsConNovedadHoy lo filtra).
// - resetHorarios: invalidaba TODAS las queries de la app. Nadie la llamaba;
//   el botón "Actualizar" del header tiene su propia lógica.

export const eliminarEmpleado = (_idEmpleado: string) => {};

export const crearResetHorarios =
	(queryClient: QueryClient, setError: (e: string | null) => void) =>
	async () => {
		setError(null);
		await queryClient.invalidateQueries();
		await queryClient.refetchQueries({ type: 'active' });
	};
