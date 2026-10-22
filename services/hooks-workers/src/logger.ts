import { createRequire } from 'node:module';
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

let hasPinoPretty = false;
if (!isProduction) {
	try {
		const req = createRequire(import.meta.url);
		req.resolve('pino-pretty');
		hasPinoPretty = true;
	} catch {
		hasPinoPretty = false;
	}
}

export const baseLogger = pino({
	level: logLevel,
	...(isProduction || !hasPinoPretty
		? {}
		: {
				transport: {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'yyyy-mm-dd HH:MM:ss.l',
						ignore: 'pid,hostname',
					},
				},
			}),
});