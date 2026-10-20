import type { Rol } from '../navigation/secciones';
import type { Tienda } from './tiendas';

/** Roles y tiendas permitidas del usuario (lo resuelve `useHorariosAcceso`). */
export interface HorariosAcceso {
	cargando: boolean;
	roles: ReadonlySet<Rol>;
	rolPrincipal: Rol;
	puede: (roles: readonly Rol[]) => boolean;
	/** Sección inicial (relativa a BASE) según el rol principal. */
	inicio: string;
	puedeVerDemo: boolean;
	/** Tienda asignada al usuario en Directus (`readMe().store_id`). */
	tiendaPropia: number | null;
	/** admin/report: todas · areaManager: sus tiendas asignadas · tienda: ninguna. */
	tiendasPermitidas: Tienda[];
	/** comercial: todas las tiendas (solo se usan en sus sub‑secciones) · resto: ninguna. */
	tiendasComercial: Tienda[];
}
