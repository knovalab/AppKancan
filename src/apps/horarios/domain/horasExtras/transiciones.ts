import { ESTADO_HORA_EXTRA as E, type EstadoHoraExtra } from './estados';

export type ActorHoraExtra = 'lider' | 'comercial';

type Transicion = {
	actor: ActorHoraExtra;
	/** `null` = la fila aún no existe (creación). */
	de: EstadoHoraExtra | null;
	a: EstadoHoraExtra;
};

/**
 * Transiciones permitidas. Directus las vuelve a exigir con los permisos de cada
 * política; esto es lo que usa la UI para mostrar u ocultar acciones.
 * El líder no puede retirar una pendiente (decisión P6 del 2026-10-20).
 */
const TRANSICIONES: readonly Transicion[] = [
	{ actor: 'lider', de: null, a: E.pendiente },
	{ actor: 'lider', de: E.sugerida, a: E.pendiente },
	{ actor: 'lider', de: E.sugerida, a: E.descartadaLider },
	{ actor: 'lider', de: E.pendiente, a: E.pendiente }, // editar minutos, tienda u observación
	{ actor: 'comercial', de: E.pendiente, a: E.aprobada },
	{ actor: 'comercial', de: E.pendiente, a: E.descartadaComercial },
];

export const puedeTransicionar = (
	actor: ActorHoraExtra,
	de: EstadoHoraExtra | null,
	a: EstadoHoraExtra,
): boolean =>
	TRANSICIONES.some((t) => t.actor === actor && t.de === de && t.a === a);
