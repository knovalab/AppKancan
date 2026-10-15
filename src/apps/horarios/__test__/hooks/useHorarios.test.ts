import { act, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import * as directusCreate from '../../api/directus/create';
import * as directusRead from '../../api/directus/read';
import { ESTADO, EVENTO, LOG_TYPE } from '../../domain/registro';
import { useHorarios } from '../../hooks/useHorarios';
import { createMockEmpleadoAsistencia } from '../utils/mocks/employees.mock';
import { createMockTimeRecord } from '../utils/mocks/records.mock';
import { renderHookWithQuery } from '../utils/test-utils';

vi.mock('@/shared/components/SnackbarsPosition/SnackbarContext', () => ({
	useGlobalSnackbar: vi.fn(),
}));

vi.mock('../../utils/timeSync', () => ({
	getRealColombiaTime: vi.fn(() => dayjs('2026-10-14T08:30:00')),
}));

vi.mock('../../api/directus/read', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../api/directus/read')>();
	return {
		...actual,
		getStoreIdUsuarioActual: vi.fn(),
		getEmpleados: vi.fn(),
		getTiposNovedad: vi.fn(),
		getReasons: vi.fn(),
		getNovedades: vi.fn(),
		getTimeRecords: vi.fn(),
		getStoreEventReportsToday: vi.fn(),
		// Consulta fresca de "¿ya existe esta marcación?" (rechazo de repetidas).
		getMarcacionExistenteId: vi.fn().mockResolvedValue(null),
	};
});

vi.mock('../../api/directus/create', () => ({
	createEventReport: vi.fn(),
	createNovedades: vi.fn(),
	createTimeRecord: vi.fn(),
	updateTimeRecord: vi.fn(),
	upsertRecordReason: vi.fn(),
}));

describe('useHorarios', () => {
	const mockedUseGlobalSnackbar = vi.mocked(useGlobalSnackbar);
	const mockedGetStoreIdUsuarioActual = vi.mocked(
		directusRead.getStoreIdUsuarioActual,
	);
	const mockedGetEmpleados = vi.mocked(directusRead.getEmpleados);
	const mockedGetTiposNovedad = vi.mocked(directusRead.getTiposNovedad);
	const mockedGetReasons = vi.mocked(directusRead.getReasons);
	const mockedGetNovedades = vi.mocked(directusRead.getNovedades);
	const mockedGetTimeRecords = vi.mocked(directusRead.getTimeRecords);
	const mockedGetStoreEventReportsToday = vi.mocked(
		directusRead.getStoreEventReportsToday,
	);

	const mockedCreateTimeRecord = vi.mocked(directusCreate.createTimeRecord);
	const mockedUpdateTimeRecord = vi.mocked(directusCreate.updateTimeRecord);
	const mockedUpsertRecordReason = vi.mocked(directusCreate.upsertRecordReason);
	const mockedCreateNovedades = vi.mocked(directusCreate.createNovedades);
	const mockedCreateEventReport = vi.mocked(directusCreate.createEventReport);

	const mockShowSnackbar = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		mockedUseGlobalSnackbar.mockReturnValue({
			showSnackbar: mockShowSnackbar,
		});

		mockedGetStoreIdUsuarioActual.mockResolvedValue(5);
		mockedGetEmpleados.mockResolvedValue([
			createMockEmpleadoAsistencia({ id: '101', nombre: 'Juan Pérez' }),
		]);
		mockedGetTiposNovedad.mockResolvedValue([
			{ id: 1, name: 'Incapacidad', nombre: 'Incapacidad' },
			{ id: 2, name: 'Permiso', nombre: 'Permiso' },
		]);
		mockedGetReasons.mockResolvedValue([
			{ id: 1, name: 'Cita médica' },
			{ id: 2, name: 'Tráfico' },
		]);
		mockedGetNovedades.mockResolvedValue([]);
		mockedGetTimeRecords.mockResolvedValue([]);
		mockedGetStoreEventReportsToday.mockResolvedValue([]);

		mockedCreateTimeRecord.mockResolvedValue({
			id: 10,
			log_type: 'Comenzar Jornada',
		});
		mockedUpdateTimeRecord.mockResolvedValue({ id: 10 });
		mockedUpsertRecordReason.mockResolvedValue({});
		mockedCreateNovedades.mockResolvedValue([]);
		mockedCreateEventReport.mockResolvedValue({ id: 1 });
	});

	describe('Store Resolution & Initial Queries', () => {
		it('should prioritize storeOverride when provided without calling user store query', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(99));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			expect(mockedGetEmpleados).toHaveBeenCalledWith(99);
			expect(mockedGetNovedades).toHaveBeenCalledWith(99);
			expect(mockedGetTimeRecords).toHaveBeenCalledWith(99, '2026-10-14');
			expect(result.current.empleados).toHaveLength(1);
			expect(result.current.tiposNovedad).toHaveLength(2);
			expect(result.current.reasons).toHaveLength(2);
		});

		it('should fallback to user store when storeOverride is null or undefined', async () => {
			const { result } = renderHookWithQuery(() => useHorarios());

			await waitFor(() => {
				expect(mockedGetEmpleados).toHaveBeenCalledWith(5);
			});

			expect(mockedGetStoreIdUsuarioActual).toHaveBeenCalled();
			expect(mockedGetTimeRecords).toHaveBeenCalledWith(5, '2026-10-14');
			expect(result.current.empleados).toHaveLength(1);
		});

		it('should disable store-specific queries when no store is resolved', async () => {
			mockedGetStoreIdUsuarioActual.mockResolvedValue(null);

			const { result } = renderHookWithQuery(() => useHorarios(null));

			await waitFor(() => {
				expect(result.current.tiposNovedad).toHaveLength(2);
			});

			expect(mockedGetEmpleados).not.toHaveBeenCalled();
			expect(mockedGetNovedades).not.toHaveBeenCalled();
			expect(mockedGetTimeRecords).not.toHaveBeenCalled();
			expect(mockedGetStoreEventReportsToday).not.toHaveBeenCalled();
			expect(result.current.empleados).toHaveLength(0);
		});
	});

	describe('Attendance Mapping & Derived State', () => {
		it('should map time records to employee attendance registers and determine correct estadoActual', async () => {
			const mockEmployees = [
				createMockEmpleadoAsistencia({ id: '101', nombre: 'Juan Pérez' }),
				createMockEmpleadoAsistencia({ id: '102', nombre: 'Ana Gómez' }),
			];
			mockedGetEmpleados.mockResolvedValue(mockEmployees);

			const mockRecords = [
				createMockTimeRecord({
					id: 1,
					log_type: LOG_TYPE.inicioJornada,
					record_time: '08:05:00',
					observations: 'Llegada normal',
				}),
				createMockTimeRecord({
					id: 2,
					log_type: LOG_TYPE.inicioAlmuerzo,
					record_time: '12:35:00',
				}),
			];
			mockedGetTimeRecords.mockResolvedValue(mockRecords);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.empleados).toHaveLength(2);
			});

			const emp101 = result.current.empleados.find((e) => e.id === '101');
			const emp102 = result.current.empleados.find((e) => e.id === '102');

			expect(emp101?.registros.inicioJornada).toBe('08:05');
			expect(emp101?.registros.inicioAlmuerzo).toBe('12:35');
			expect(emp101?.registros.observaciones.inicioJornada).toBe(
				'Llegada normal',
			);
			expect(emp101?.registros.ids.inicioJornada).toBe(1);
			expect(emp101?.estadoActual).toBe(ESTADO.enAlmuerzo);

			expect(emp102?.registros.inicioJornada).toBeNull();
			expect(emp102?.estadoActual).toBe(ESTADO.entradaPendiente);
		});

		it('should count finished active pauses for each employee today', async () => {
			mockedGetEmpleados.mockResolvedValue([
				createMockEmpleadoAsistencia({ id: '101' }),
			]);
			mockedGetStoreEventReportsToday.mockResolvedValue([
				{
					id: 1,
					employee_id: 101,
					event_type: EVENTO.terminarPausaActiva,
					date: '2026-10-14',
				},
				{
					id: 2,
					employee_id: { id: 101 },
					event_type: EVENTO.terminarPausaActiva,
					date: '2026-10-14',
				},
				{
					id: 3,
					employee_id: 101,
					event_type: EVENTO.iniciarPausaActiva,
					date: '2026-10-14',
				},
			]);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.empleados[0]?.pausasActivasCount).toBe(2);
			});
		});

		it('should filter out employees who have a novelty for today', async () => {
			mockedGetEmpleados.mockResolvedValue([
				createMockEmpleadoAsistencia({ id: '101', nombre: 'Juan Pérez' }),
				createMockEmpleadoAsistencia({ id: '102', nombre: 'Ana Gómez' }),
			]);

			mockedGetNovedades.mockResolvedValue([
				{
					id: 1,
					employee_id: 102,
					report_date: '2026-10-14',
					newness_id: { name: 'Incapacidad' },
				},
			]);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.empleados).toHaveLength(1);
			});

			expect(result.current.empleados[0]?.id).toBe('101');
		});

		it('should map novedades into structured format with names and active status', async () => {
			mockedGetEmpleados.mockResolvedValue([
				createMockEmpleadoAsistencia({ id: '101', nombre: 'Juan Pérez' }),
			]);

			mockedGetNovedades.mockResolvedValue([
				{
					id: 'nov-1',
					employee_id: {
						id: 101,
						first_name: 'Juan',
						last_name: 'Pérez',
						document_number: '1234567890',
					},
					store_id: { name: 'Tienda Norte' },
					newness_id: { name: 'Permiso' },
					report_date: '2026-10-14',
					observations: 'Cita médica dental',
				},
				{
					id: 'nov-2',
					employee_id: 999,
					store_id: null,
					newness_id: 1,
					date_created: '2026-10-13T10:00:00Z',
					observations: 'Antigua',
				},
			]);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.novedades).toHaveLength(2);
			});

			expect(result.current.novedades[0]).toMatchObject({
				id: 'nov-1',
				empleadoNombre: 'Juan Pérez',
				empleadoDocumento: '1234567890',
				tipo: 'Permiso',
				observaciones: 'Cita médica dental',
				tiendaNombre: 'Tienda Norte',
				empleadoActivo: true,
			});

			expect(result.current.novedades[1]).toMatchObject({
				id: 'nov-2',
				empleadoNombre: 'Empleado #999',
				tipo: 'Incapacidad',
				tiendaNombre: 'Sin tienda',
				empleadoActivo: false,
			});
		});
	});

	describe('registrarEvento', () => {
		it('should create a new time record when no existing record exists for that event today', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.registrarEvento(
					'101',
					LOG_TYPE.inicioJornada,
					undefined,
					'Llegada a tiempo',
					null,
					{
						latitude: 4.6097,
						longitude: -74.0817,
						accuracy: 10,
						photo: 'data:image/jpeg;base64,mock',
					},
				);
			});

			expect(mockedCreateTimeRecord.mock.calls[0][0]).toEqual({
				employee_id: 101,
				store_id: 5,
				log_type: LOG_TYPE.inicioJornada,
				record_date: '2026-10-14',
				record_time: '08:30:00',
				observations: 'Llegada a tiempo',
				latitude: 4.6097,
				longitude: -74.0817,
				accuracy: 10,
				photo: 'data:image/jpeg;base64,mock',
			});
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Registro de "Comenzar Jornada" guardado con éxito',
				'success',
			);
		});

		it('should update existing time record when one already exists for that event today', async () => {
			mockedGetTimeRecords.mockResolvedValue([
				createMockTimeRecord({
					id: 42,
					log_type: LOG_TYPE.inicioJornada,
					record_date: '2026-10-14',
					record_time: '08:00:00',
					original_record_time: null,
				}),
			]);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.registrarEvento(
					'101',
					LOG_TYPE.inicioJornada,
					'08:15 AM',
					'Ajuste manual',
				);
			});

			expect(mockedUpdateTimeRecord).toHaveBeenCalledWith(42, {
				record_time: '08:15:00',
				original_record_time: '08:00:00',
				observations: 'Ajuste manual',
			});
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Registro actualizado correctamente',
				'success',
			);
		});

		it('should call upsertRecordReason when editing the hour with a reasonId', async () => {
			mockedGetTimeRecords.mockResolvedValue([
				createMockTimeRecord({
					id: 42,
					log_type: LOG_TYPE.inicioJornada,
					record_date: '2026-10-14',
					record_time: '08:00:00',
					original_record_time: null,
				}),
			]);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.empleados[0]?.registros.ids.inicioJornada).toBe(
					42,
				);
			});

			await act(async () => {
				await result.current.registrarEvento(
					'101',
					LOG_TYPE.inicioJornada,
					'08:15 AM',
					'',
					2,
				);
			});

			expect(mockedUpsertRecordReason).toHaveBeenCalledWith(42, 2);
		});

		it('should reject a repeated mark that already exists in Directus', async () => {
			vi.mocked(directusRead.getMarcacionExistenteId).mockResolvedValueOnce(77);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await expect(
					result.current.registrarEvento('101', LOG_TYPE.inicioJornada),
				).rejects.toThrow('ya está registrada');
			});

			expect(mockedCreateTimeRecord).not.toHaveBeenCalled();
		});

		it('should throw and show error snackbar when creation fails', async () => {
			mockedCreateTimeRecord.mockRejectedValueOnce(
				new Error('Error de conexión con el servidor'),
			);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			// La fachada lanza para que el modal de foto muestre el error y no se cierre.
			await act(async () => {
				await expect(
					result.current.registrarEvento('101', LOG_TYPE.inicioJornada),
				).rejects.toThrow('Error de conexión con el servidor');
			});

			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Error de conexión con el servidor',
				'error',
			);
		});
	});

	describe('guardarObservacion', () => {
		it('should update observation for an employee existing event record', async () => {
			mockedGetTimeRecords.mockResolvedValue([
				createMockTimeRecord({
					id: 99,
					log_type: LOG_TYPE.inicioJornada,
					record_date: '2026-10-14',
					record_time: '08:00:00',
				}),
			]);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			await act(async () => {
				await result.current.guardarObservacion(
					'101',
					LOG_TYPE.inicioJornada,
					'Nueva nota importante',
				);
			});

			expect(mockedUpdateTimeRecord).toHaveBeenCalledWith(99, {
				observations: 'Nueva nota importante',
			});
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Registro actualizado correctamente',
				'success',
			);
		});

		it('should show an error snackbar and return false when no time record exists', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			let guardado = true;
			await act(async () => {
				guardado = await result.current.guardarObservacion(
					'101',
					LOG_TYPE.finJornada,
					'Nota sin registro previo',
				);
			});

			expect(guardado).toBe(false);
			expect(mockedUpdateTimeRecord).not.toHaveBeenCalled();
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'No se encontró el registro de tiempo para actualizar la observación.',
				'error',
			);
		});
	});

	describe('agregarNovedad', () => {
		it('should return false and set error if novelty type is invalid', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			let success = true;
			await act(async () => {
				success = await result.current.agregarNovedad({
					empleadoId: '101',
					empleadoNombre: 'Juan Pérez',
					tipo: 'TipoDesconocido',
					fechaInicio: '2026-10-14',
					fechaFin: '2026-10-15',
					observaciones: 'Test',
					fechaRegistro: '2026-10-14',
				});
			});

			expect(success).toBe(false);
			expect(result.current.error).toBe(
				'Tipo de novedad "TipoDesconocido" no válido.',
			);
		});

		it('should return false and set error if fechaFin is before fechaInicio', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			let success = true;
			await act(async () => {
				success = await result.current.agregarNovedad({
					empleadoId: '101',
					empleadoNombre: 'Juan Pérez',
					tipo: 'Incapacidad',
					fechaInicio: '2026-10-20',
					fechaFin: '2026-10-18',
					observaciones: 'Fechas invertidas',
					fechaRegistro: '2026-10-14',
				});
			});

			expect(success).toBe(false);
			expect(result.current.error).toBe(
				'La fecha fin debe ser igual o posterior a la de inicio.',
			);
		});

		it('should generate multi-day novelty reports and show success snackbar', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			let success = false;
			await act(async () => {
				success = await result.current.agregarNovedad({
					empleadoId: '101',
					empleadoNombre: 'Juan Pérez',
					tipo: 'Incapacidad',
					fechaInicio: '2026-10-14',
					fechaFin: '2026-10-16',
					observaciones: 'Reposo médico 3 días',
					fechaRegistro: '2026-10-14',
				});
			});

			expect(success).toBe(true);
			expect(mockedCreateNovedades.mock.calls[0][0]).toEqual([
				{
					employee_id: 101,
					newness_id: 1,
					report_date: '2026-10-14',
					observations: 'Reposo médico 3 días',
					store_id: 5,
				},
				{
					employee_id: 101,
					newness_id: 1,
					report_date: '2026-10-15',
					observations: 'Reposo médico 3 días',
					store_id: 5,
				},
				{
					employee_id: 101,
					newness_id: 1,
					report_date: '2026-10-16',
					observations: 'Reposo médico 3 días',
					store_id: 5,
				},
			]);
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Novedad registrada con éxito',
				'success',
			);
		});
	});

	describe('reportarEvento', () => {
		it('should report event with real time, show snackbar and return true', async () => {
			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			let success = false;
			await act(async () => {
				success = await result.current.reportarEvento(
					'101',
					EVENTO.iniciarPausaActiva,
					'Pausa activa grupal',
				);
			});

			expect(success).toBe(true);
			expect(mockedCreateEventReport).toHaveBeenCalledWith({
				employee_id: 101,
				event_type: EVENTO.iniciarPausaActiva,
				observations: 'Pausa activa grupal',
				store_id: 5,
				date: '2026-10-14',
				hour: '08:30:00',
			});
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Evento reportado con éxito',
				'success',
			);
		});

		it('should handle event report error and return false', async () => {
			mockedCreateEventReport.mockRejectedValueOnce(
				new Error('Fallo al reportar evento'),
			);

			const { result } = renderHookWithQuery(() => useHorarios(5));

			await waitFor(() => {
				expect(result.current.loading).toBe(false);
			});

			let success = true;
			await act(async () => {
				success = await result.current.reportarEvento(
					'101',
					EVENTO.iniciarPausaActiva,
				);
			});

			expect(success).toBe(false);
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Fallo al reportar evento',
				'error',
			);
		});
	});
});
