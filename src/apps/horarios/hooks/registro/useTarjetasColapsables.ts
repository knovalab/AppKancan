import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	calcularEstado,
	ESTADO,
	type EstadoAsistencia,
} from '../../domain/registro';
import type { EmpleadoAsistencia } from '../../domain/registro/modelo';

export type FiltroColapso =
	| 'activas'
	| 'pendientes'
	| 'finalizadas'
	| EstadoAsistencia;

const PREFIX_STORAGE_KEY = 'horarios:registros:colapsadas:';

function getStorageKey(storeId: number | string | null | undefined): string {
	return `${PREFIX_STORAGE_KEY}${storeId ?? 'default'}`;
}

function loadCollapsedFromStorage(
	storeId: number | string | null | undefined,
): Set<string> {
	if (typeof window === 'undefined' || storeId == null) return new Set();
	try {
		const raw = localStorage.getItem(getStorageKey(storeId));
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			return new Set(parsed.map(String));
		}
	} catch {
		// Silencioso si localStorage no está disponible o está bloqueado
	}
	return new Set();
}

function saveCollapsedToStorage(
	storeId: number | string | null | undefined,
	collapsedSet: Set<string>,
): void {
	if (typeof window === 'undefined' || storeId == null) return;
	try {
		localStorage.setItem(
			getStorageKey(storeId),
			JSON.stringify(Array.from(collapsedSet)),
		);
	} catch {
		// Silencioso si localStorage no está disponible o está bloqueado
	}
}

/**
 * Hook para gestionar y persistir el estado expandido/contraído de las tarjetas de empleados en RegistrosPage.
 *
 * - Persiste en `localStorage` por tienda (`storeId`).
 * - Por defecto, una tarjeta sin registro de colapso se muestra **expandida**.
 * - Ofrece métodos para alternar (`toggle`), expandir todas, contraer todas y expandir por estado de jornada.
 */
export function useTarjetasColapsables(
	storeId?: number | string | null,
	empleados: EmpleadoAsistencia[] = [],
) {
	const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() =>
		loadCollapsedFromStorage(storeId),
	);

	// Si cambia de tienda, cargamos el set de IDs guardado para esa tienda.
	useEffect(() => {
		setCollapsedIds(loadCollapsedFromStorage(storeId));
	}, [storeId]);

	// Guardar en localStorage cuando cambie collapsedIds
	const updateCollapsed = useCallback(
		(updater: (prev: Set<string>) => Set<string>) => {
			setCollapsedIds((prev) => {
				const next = updater(prev);
				saveCollapsedToStorage(storeId, next);
				return next;
			});
		},
		[storeId],
	);

	const isExpanded = useCallback(
		(id: string) => !collapsedIds.has(String(id)),
		[collapsedIds],
	);

	const toggle = useCallback(
		(id: string) => {
			const strId = String(id);
			updateCollapsed((prev) => {
				const next = new Set(prev);
				if (next.has(strId)) {
					next.delete(strId);
				} else {
					next.add(strId);
				}
				return next;
			});
		},
		[updateCollapsed],
	);

	const expandirTodas = useCallback(() => {
		updateCollapsed(() => new Set());
	}, [updateCollapsed]);

	const contraerTodas = useCallback(() => {
		updateCollapsed(() => new Set(empleados.map((e) => String(e.id))));
	}, [empleados, updateCollapsed]);

	const expandirPorEstado = useCallback(
		(filtro: FiltroColapso) => {
			const coincideConFiltro = (estado: EstadoAsistencia): boolean => {
				if (filtro === 'activas') {
					return (
						estado === ESTADO.jornadaIniciada ||
						estado === ESTADO.enAlmuerzo ||
						estado === ESTADO.regresoAlmuerzo
					);
				}
				if (filtro === 'pendientes') {
					return estado === ESTADO.entradaPendiente;
				}
				if (filtro === 'finalizadas') {
					return estado === ESTADO.jornadaFinalizada;
				}
				return estado === filtro;
			};

			updateCollapsed((prev) => {
				const next = new Set(prev);
				for (const emp of empleados) {
					const estado = calcularEstado(emp.registros);
					const empId = String(emp.id);
					if (coincideConFiltro(estado)) {
						// Debe estar expandida -> quitar de colapsadas
						next.delete(empId);
					} else {
						// Debe estar colapsada -> agregar a colapsadas
						next.add(empId);
					}
				}
				return next;
			});
		},
		[empleados, updateCollapsed],
	);

	const totalEmpleados = empleados.length;
	const totalColapsadas = useMemo(() => {
		let count = 0;
		for (const emp of empleados) {
			if (collapsedIds.has(String(emp.id))) count++;
		}
		return count;
	}, [empleados, collapsedIds]);

	const totalExpandidas = totalEmpleados - totalColapsadas;
	const todasExpandidas = totalColapsadas === 0 && totalEmpleados > 0;
	const todasColapsadas =
		totalColapsadas === totalEmpleados && totalEmpleados > 0;

	return {
		isExpanded,
		toggle,
		expandirTodas,
		contraerTodas,
		expandirPorEstado,
		totalEmpleados,
		totalExpandidas,
		totalColapsadas,
		todasExpandidas,
		todasColapsadas,
	};
}
