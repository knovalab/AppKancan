/**
 * Ejecución manual (backfill o pruebas):
 *   node --env-file-if-exists=.env src/jobs/cli.ts --fecha=2026-10-16 [--hasta=2026-10-20] [--dry-run]
 *   node --env-file-if-exists=.env src/jobs/cli.ts --nocturno [--dry-run]   (lo mismo que el cron)
 */
import { parseArgs } from 'node:util';
import { leerConfig } from '../config.ts';
import { crearClienteDirectus } from '../directus/client.ts';
import { describirError } from '../directus/errors.ts';
import { esFecha, rangoFechas } from '../fecha.ts';
import { ejecutarDiaTienda, ejecutarNocturno } from './etlDiario.ts';

const { values } = parseArgs({
	options: {
		fecha: { type: 'string' },
		hasta: { type: 'string' },
		'dry-run': { type: 'boolean', default: false },
		nocturno: { type: 'boolean', default: false },
	},
});
const dryRun = values['dry-run'];

try {
	const directus = crearClienteDirectus(leerConfig());
	if (values.nocturno) {
		console.log(
			JSON.stringify(await ejecutarNocturno(directus, { dryRun }), null, 2),
		);
	} else {
		const desde = values.fecha ?? '';
		const hasta = values.hasta ?? desde;
		if (!esFecha(desde) || !esFecha(hasta) || hasta < desde) {
			console.error(
				'Uso: --fecha=YYYY-MM-DD [--hasta=YYYY-MM-DD] [--dry-run] | --nocturno',
			);
			process.exit(2);
		}
		for (const fecha of rangoFechas(desde, hasta))
			console.log(
				JSON.stringify(
					await ejecutarDiaTienda(directus, fecha, { dryRun }),
					null,
					2,
				),
			);
	}
} catch (err) {
	console.error(`❌ ${describirError(err)}`);
	process.exit(1);
}
