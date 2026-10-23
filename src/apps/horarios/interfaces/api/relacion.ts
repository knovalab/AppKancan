/**
 * Campo relacional de Directus (M2O). Según los `fields` pedidos llega como el id
 * (número o string) o como el objeto expandido; `null` si no hay relación.
 * Para leer el id usa `idRelacion()` de api/directus/read.
 */
export type Relacion<
	T extends { id?: number | string } = { id: number | string },
> = number | string | T | null;
