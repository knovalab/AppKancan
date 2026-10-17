import { serve } from '@hono/node-server';
import { crearApp } from './app.ts';
import { directusConfigurado, leerConfig } from './config.ts';
import { crearClienteDirectus } from './directus/client.ts';
import { programarDiario } from './jobs/cron.ts';
import { ejecutarNocturno } from './jobs/etlDiario.ts';

const config = leerConfig();
const directus = directusConfigurado(config)
	? crearClienteDirectus(config)
	: null;
const app = crearApp(config, { directus });

// Cada noche a las 02:00 (Bogotá): periodo de hoy + día operativo de ayer.
let detenerCron = () => {};
if (directus) {
	detenerCron = programarDiario(2, 'etl nocturno', () =>
		ejecutarNocturno(directus),
	);
} else {
	console.warn('⚠️ Directus no configurado: el cron nocturno no se programa');
}

const server = serve(
	{ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' },
	(info) => {
		console.log(
			`horarios-etl escuchando en http://localhost:${info.port} (TZ=${config.timezone})`,
		);
	},
);

// Cierre ordenado: Docker envía SIGTERM al detener el contenedor.
for (const senal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(senal, () => {
		console.log(`${senal} recibido, cerrando…`);
		detenerCron();
		server.close(() => process.exit(0));
	});
}
