import { LOG_TYPE } from '@/apps/horarios/domain/registro';
import type { TimeRecordDto } from '../../../interfaces/api/timeRecords';

export function createMockTimeRecord(
	overrides: Partial<TimeRecordDto> = {},
): TimeRecordDto {
	return {
		id: 1,
		record_date: '2026-10-14',
		record_time: '08:00:00',
		original_record_time: null,
		log_type: LOG_TYPE.inicioJornada,
		employee_id: {
			id: 101,
			document_number: '1234567890',
			first_name: 'Juan',
			middle_name: 'Carlos',
			last_name: 'Pérez',
			second_last_name: 'Gómez',
		},
		store_id: {
			id: 5,
			name: 'Tienda Central',
		},
		observations: null,
		...overrides,
	};
}

export function createMockFullDayRecords(): TimeRecordDto[] {
	return [
		createMockTimeRecord({
			id: 1,
			log_type: LOG_TYPE.inicioJornada,
			record_time: '08:00:00',
		}),
		createMockTimeRecord({
			id: 2,
			log_type: LOG_TYPE.inicioAlmuerzo,
			record_time: '12:30:00',
			observations: 'Almuerzo regular',
		}),
		createMockTimeRecord({
			id: 3,
			log_type: LOG_TYPE.finAlmuerzo,
			record_time: '13:30:00',
		}),
		createMockTimeRecord({
			id: 4,
			log_type: LOG_TYPE.finJornada,
			record_time: '17:00:00',
			observations: 'Cierre puntual',
		}),
	];
}
