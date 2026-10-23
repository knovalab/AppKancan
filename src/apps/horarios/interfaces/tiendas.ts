export interface Tienda {
	id: number;
	name: string;
	ultra_code?: string | number;
	company?: string;
}

/** Selección de tienda del header (`?tienda=`). */
export type TiendaSeleccion =
	| { tipo: 'propia' }
	| { tipo: 'todas' }
	| { tipo: 'una'; id: number };

export interface TiendaSeleccionada {
	/** Selección efectiva, ya validada contra el rol y la sección. */
	seleccion: TiendaSeleccion;
	/** Tienda concreta, o null cuando la selección es "todas". */
	storeId: number | null;
	/** Siempre explícito: [id] para una tienda, las permitidas para "todas". */
	storeIds: number[];
	/** Nombre para mostrar en el header ('' si es "todas" o se desconoce). */
	nombre: string;
	setSeleccion: (s: TiendaSeleccion) => void;
}

/** Tienda reducida para selectores y listas (id + nombre ya resuelto). */
export interface TiendaOpcion {
	id: number;
	nombre: string;
}
