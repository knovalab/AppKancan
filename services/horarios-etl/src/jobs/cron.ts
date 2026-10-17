import { describirError } from '../directus/errors.ts';
import { msHastaProxima } from '../fecha.ts';

/**
 * Ejecuta `tarea` todos los días a la hora indicada (hora de Bogotá), sin dependencias.
 * Devuelve una función para detenerlo.
 * shortcut: si el proceso está caído a esa hora, ese día no se ejecuta; recuperar con el CLI (--fecha). Pasar a cola/registro de ejecuciones (com_etl_runs) si hace falta garantía.
 */
export function programarDiario(
	hora: number,
	nombre: string,
	tarea: () => Promise<unknown>,
): () => void {
	let timer: NodeJS.Timeout;
	const siguiente = () => {
		const ms = msHastaProxima(hora);
		console.log(
			`⏰ ${nombre}: próxima ejecución en ${Math.round(ms / 60000)} min`,
		);
		timer = setTimeout(async () => {
			try {
				console.log(`▶️ ${nombre}:`, JSON.stringify(await tarea()));
			} catch (err) {
				console.error(`❌ ${nombre}: ${describirError(err)}`);
			}
			siguiente();
		}, ms);
	};
	siguiente();
	return () => clearTimeout(timer);
}
