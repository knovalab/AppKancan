// Módulo propio para que read.ts y readBulk.ts lo usen sin importarse entre sí.
/** Id de una relación M2O de Directus, venga como objeto `{ id }` o como valor plano. */
export const idRelacion = (val: unknown): number | null => {
	const raw =
		val != null && typeof val === 'object' ? (val as { id?: unknown }).id : val;
	const num = Number(raw);
	return Number.isFinite(num) ? num : null;
};
