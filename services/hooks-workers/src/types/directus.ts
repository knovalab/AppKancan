/**
 * Directus entity types
 */
export interface Store {
	id: string;
	name: string;
}

export interface TimeRecordStore {
	id: number;
	open_user: string | null;
	close_user?: string | null;
	operative_time: number | null; // minutes
	work_day: string | null; // YYYY-MM-DD
	close_time: string | null; // AAAA-MM-DDTHH:mm:ss
	open_time: string | null; // AAAA-MM-DDTHH:mm:ss
	store: string | null;
}

export interface TimeRecords {
	id: number;
	store_id: string | Store | null;
	employee_id: string | null;
	log_type:
		| 'Comenzar Jornada'
		| 'Terminar Jornada'
		| 'Iniciar Almuerzo'
		| 'Finalizar Almuerzo';
	record_time: string | null; // HH:mm
	record_date: string | null; // YYYY-MM-DD
}

/**
 * Directus Service Interface
 * Declares the exact Directus methods available to handlers and workers.
 */
export interface DirectusService {
	getStores(params?: Record<string, unknown>): Promise<Store[]>;
	getStoreById(id: string | number): Promise<Store | null>;
	getTimeRecordStores(
		params?: Record<string, unknown>,
	): Promise<TimeRecordStore[]>;
	createTimeRecordStore(
		data: Partial<TimeRecordStore>,
	): Promise<TimeRecordStore>;
	updateTimeRecordStore(
		id: number,
		data: Partial<TimeRecordStore>,
	): Promise<TimeRecordStore>;
	getTimeRecords(params?: Record<string, unknown>): Promise<TimeRecords[]>;
	getTimeRecordById(
		id: string | number,
		params?: Record<string, unknown>,
	): Promise<TimeRecords | null>;
}

export interface DirectusSchema {
	core_stores: Store[];
	com_time_record_store: TimeRecordStore[];
	com_time_records: TimeRecords[];
}
