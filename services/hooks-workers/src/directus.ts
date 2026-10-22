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
import type {
	DirectusSchema,
	DirectusService,
	Store,
	TimeRecordStore,
	TimeRecords,
} from './types/index.ts';

const directusUrl =
	process.env.DIRECTUS_URL ||
	process.env.VITE_DIRECTUS_URL ||
	'https://directus.kancan.knovalab.com';

const serviceToken =
	process.env.DIRECTUS_SERVICE_TOKEN || process.env.DIRECTUS_STATIC_TOKEN || '';

const client = createDirectus<DirectusSchema>(directusUrl)
	.with(rest())
	.with(staticToken(serviceToken));

export const directus: DirectusService = {
	...client,
	async getStores(params?: Record<string, unknown>): Promise<Store[]> {
		return (await client.request(
			readItems('core_stores', params),
		)) as unknown as Store[];
	},
	async getStoreById(id: string | number): Promise<Store | null> {
		return await client.request(readItem('core_stores', id));
	},
	async getTimeRecordStores(
		params?: Record<string, unknown>,
	): Promise<TimeRecordStore[]> {
		return (await client.request(
			readItems('com_time_record_store', params),
		)) as unknown as TimeRecordStore[];
	},
	async createTimeRecordStore(
		data: Partial<TimeRecordStore>,
	): Promise<TimeRecordStore> {
		return (await client.request(
			createItem('com_time_record_store', data),
		)) as unknown as TimeRecordStore;
	},
	async updateTimeRecordStore(
		id: number,
		data: Partial<TimeRecordStore>,
	): Promise<TimeRecordStore> {
		return (await client.request(
			updateItem('com_time_record_store', id, data),
		)) as unknown as TimeRecordStore;
	},
	async getTimeRecords(
		params?: Record<string, unknown>,
	): Promise<TimeRecords[]> {
		return (await client.request(
			readItems('com_time_records', params),
		)) as unknown as TimeRecords[];
	},
	async getTimeRecordById(
		id: string | number,
		fields?: string[],
	): Promise<TimeRecords | null> {
		return (await client.request(
			readItem(
				'com_time_records',
				id,
				(fields ? { fields } : undefined) as any,
			),
		)) as unknown as TimeRecords | null;
	},
};

export { createItem, deleteItem, readItem, readItems, updateItem };
