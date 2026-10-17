/**
 * Fechas en hora de Bogotá sin dependencias: Bogotá es UTC−5 fijo, sin horario de verano.
 * Las fechas se manejan como texto 'YYYY-MM-DD', igual que los campos Date de Directus.
 */
const ZONA = 'America/Bogota';

/** 'YYYY-MM-DD' de un instante, en hora de Bogotá. */
export const fechaBogota = (instante: Date = new Date()) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(instante);

export const sumarDias = (fecha: string, dias: number) => {
	const d = new Date(`${fecha}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + dias);
	return d.toISOString().slice(0, 10);
};

export const hoyBogota = () => fechaBogota();
export const ayerBogota = () => sumarDias(hoyBogota(), -1);

/** Días entre dos fechas, ambas incluidas. */
export function rangoFechas(desde: string, hasta: string): string[] {
	const dias: string[] = [];
	for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
	return dias;
}

export const esFecha = (v: string) =>
	/^\d{4}-\d{2}-\d{2}$/.test(v) && sumarDias(v, 0) === v;

/** Milisegundos hasta la próxima hora `hh:00` de Bogotá. */
export function msHastaProxima(hora: number, ahora: Date = new Date()): number {
	const objetivo = new Date(
		`${fechaBogota(ahora)}T${String(hora).padStart(2, '0')}:00:00-05:00`,
	);
	if (objetivo.getTime() <= ahora.getTime())
		objetivo.setUTCDate(objetivo.getUTCDate() + 1);
	return objetivo.getTime() - ahora.getTime();
}
