import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

export const baseLogger = pino({
	level: logLevel,
	...(isProduction
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
