import {
	createDirectus,
	createItem,
	deleteItem,
	readItem,
	readItems,
	rest,
	staticToken,
	updateItem,
} from '@directus/sdk';

const directusUrl =
	process.env.DIRECTUS_URL ||
	process.env.VITE_DIRECTUS_URL ||
	'https://directus.kancan.knovalab.com';

const serviceToken =
	process.env.DIRECTUS_SERVICE_TOKEN || process.env.DIRECTUS_STATIC_TOKEN || '';

const baseClient = createDirectus(directusUrl).with(rest());

export const directus = serviceToken
	? baseClient.with(staticToken(serviceToken))
	: baseClient;

export { createItem, deleteItem, readItem, readItems, updateItem };
