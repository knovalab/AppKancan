/**
 * Query keys de los datos del registro (las que usaba useHorarios como literales).
 *
 * Mantienen la misma forma que antes, así que las cachés existentes y las
 * invalidaciones por prefijo siguen funcionando:
 * - `x.todos` → prefijo: invalida esa colección para todas las tiendas y fechas.
 * - `x.tienda(store)` → prefijo de una tienda.
 * - `x.dia(store, fecha)` → la query concreta.
 */
type Store = number | null;

export const horariosKeys = {
	storeUsuario: ['horariosStoreId'] as const,
	tiposNovedad: ['tiposNovedad'] as const,
	reasons: ['reasons'] as const,
	empleados: {
		todos: ['empleados'] as const,
		tienda: (store: Store) => ['empleados', store] as const,
		tiendas: (stores: number[]) => ['empleados', 'tiendas', stores] as const,
	},
	novedades: {
		todos: ['novedades'] as const,
		tienda: (store: Store) => ['novedades', store] as const,
	},
	timeRecords: {
		todos: ['timeRecords'] as const,
		tienda: (store: Store) => ['timeRecords', store] as const,
		dia: (store: Store, fecha: string) =>
			['timeRecords', store, fecha] as const,
	},
	horasExtras: {
		todos: ['horasExtras'] as const,
		lista: (filtros: object) => ['horasExtras', filtros] as const,
	},
	eventosHoy: {
		todos: ['eventReportsToday'] as const,
		tienda: (store: Store) => ['eventReportsToday', store] as const,
		dia: (store: Store, fecha: string) =>
			['eventReportsToday', store, fecha] as const,
	},
};
