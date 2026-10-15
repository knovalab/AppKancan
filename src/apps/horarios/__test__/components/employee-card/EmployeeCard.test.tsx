import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeCard from '../../../components/employee-card/EmployeeCard';
import {
	crearRegistrosVacios,
	ESTADO,
	LOG_TYPE,
} from '../../../domain/registro';
import type {
	EmpleadoAsistencia,
	Motivo,
	TipoNovedad,
} from '../../../interfaces/horarios.interface';
import type { AccionesTarjeta } from '../../../interfaces/registro';

vi.mock('../../../components/verification/TimeRecordVerificationModal', () => ({
	TimeRecordVerificationModal: ({ open }: { open: boolean }) =>
		open ? (
			<div data-testid="mock-verification-modal">Verification Modal</div>
		) : null,
}));

describe('EmployeeCard', () => {
	const mockEmpleado: EmpleadoAsistencia = {
		id: 'emp-101',
		documento: '12345678',
		nombre: 'María Rodríguez',
		cargo: 'Supervisora de Ventas',
		estadoActual: ESTADO.entradaPendiente,
		registros: crearRegistrosVacios(),
		pausasActivasCount: 0,
		storeId: 1,
	};

	const mockCatalogos: { tiposNovedad: TipoNovedad[]; motivos: Motivo[] } = {
		tiposNovedad: [
			{ id: 1, nombre: 'Permiso', name: 'Permiso' },
			{ id: 2, nombre: 'Incapacidad', name: 'Incapacidad' },
		],
		motivos: [
			{ id: 1, name: 'Permiso personal' },
			{ id: 2, name: 'Cita médica' },
			{ id: 3, name: 'Otro' },
		],
	};

	const mockNormas = {
		vigentes: null,
		aceptadas: true,
		puedeAceptar: false,
	};

	const mockAcciones: AccionesTarjeta = {
		registrar: vi.fn().mockResolvedValue({ ok: true }),
		editarHora: vi.fn().mockResolvedValue({ ok: true }),
		observar: vi.fn().mockResolvedValue({ ok: true }),
		reportarEvento: vi.fn().mockResolvedValue({ ok: true }),
		agregarNovedad: vi.fn().mockResolvedValue({ ok: true }),
		verificarNormas: vi.fn().mockResolvedValue(true),
		aceptarNormas: vi.fn().mockResolvedValue({ ok: true }),
		motivoDeMarcacion: vi.fn().mockResolvedValue(null),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it('renders loading placeholder when empleado is null or undefined', () => {
		render(
			<EmployeeCard
				empleado={null as unknown as EmpleadoAsistencia}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		expect(screen.getByText('Cargando empleado...')).toBeInTheDocument();
	});

	it('renders employee card header and time slots for active employee', () => {
		render(
			<EmployeeCard
				empleado={mockEmpleado}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		expect(screen.getByText('María Rodríguez')).toBeInTheDocument();
		expect(screen.getByText('Supervisora de Ventas')).toBeInTheDocument();
		expect(screen.getByText('ENTRADA PENDIENTE')).toBeInTheDocument();

		expect(
			screen.getByRole('button', { name: /Comenzar Jornada/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Iniciar Almuerzo/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Finalizar Almuerzo/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Terminar Jornada/i }),
		).toBeInTheDocument();
	});

	it('renders "Jornada completada" message when employee has finished the day', () => {
		const finishedEmployee: EmpleadoAsistencia = {
			...mockEmpleado,
			estadoActual: ESTADO.jornadaFinalizada,
			registros: {
				...crearRegistrosVacios(),
				inicioJornada: '08:00 AM',
				inicioAlmuerzo: '12:00 PM',
				finAlmuerzo: '01:00 PM',
				finJornada: '05:00 PM',
			},
		};

		render(
			<EmployeeCard
				empleado={finishedEmployee}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		expect(screen.getByText('Jornada completada')).toBeInTheDocument();
	});

	it('opens ObservacionModal when an observable slot button is clicked', async () => {
		const user = userEvent.setup();
		const employeeWithMark: EmpleadoAsistencia = {
			...mockEmpleado,
			estadoActual: ESTADO.jornadaIniciada,
			registros: {
				...crearRegistrosVacios(),
				inicioJornada: '08:00 AM',
			},
		};

		render(
			<EmployeeCard
				empleado={employeeWithMark}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		const obsIcon = screen.getAllByTestId('AssignmentIcon')[0];
		const obsBtn = obsIcon.closest('button');
		expect(obsBtn).toBeTruthy();
		if (obsBtn) await user.click(obsBtn);

		expect(screen.getByText('Observaciones del evento')).toBeInTheDocument();
	});

	it('opens EditarHoraModal when an editable slot edit button is clicked', async () => {
		const user = userEvent.setup();
		const employeeWithMark: EmpleadoAsistencia = {
			...mockEmpleado,
			estadoActual: ESTADO.jornadaIniciada,
			registros: {
				...crearRegistrosVacios(),
				inicioJornada: '08:00 AM',
			},
		};

		render(
			<EmployeeCard
				empleado={employeeWithMark}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		const editIcon = screen.getAllByTestId('AccessTimeIcon')[0];
		const editBtn = editIcon.closest('button');
		expect(editBtn).toBeTruthy();
		if (editBtn) await user.click(editBtn);

		expect(
			screen.getByText(new RegExp(`Editar Hora - ${LOG_TYPE.inicioJornada}`)),
		).toBeInTheDocument();
	});

	it('opens OmitirAlmuerzoModal when Sin Almuerzo button is clicked', async () => {
		const user = userEvent.setup();
		const employeeAtLunch: EmpleadoAsistencia = {
			...mockEmpleado,
			estadoActual: ESTADO.jornadaIniciada,
			registros: {
				...crearRegistrosVacios(),
				inicioJornada: '08:00 AM',
			},
		};

		render(
			<EmployeeCard
				empleado={employeeAtLunch}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		const sinAlmuerzoIcon = screen.getByTestId('NoFoodIcon');
		const sinAlmuerzoBtn = sinAlmuerzoIcon.closest('button');
		expect(sinAlmuerzoBtn).toBeTruthy();
		if (sinAlmuerzoBtn) await user.click(sinAlmuerzoBtn);

		expect(
			screen.getByText('¿El turno no incluye almuerzo?'),
		).toBeInTheDocument();
	});

	it('opens EventoModal when header report event action is clicked', async () => {
		const user = userEvent.setup();
		const employeeInJornada: EmpleadoAsistencia = {
			...mockEmpleado,
			estadoActual: ESTADO.jornadaIniciada,
			registros: {
				...crearRegistrosVacios(),
				inicioJornada: '08:00 AM',
			},
		};

		render(
			<EmployeeCard
				empleado={employeeInJornada}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		// Event action button in header
		const allButtons = screen.getAllByRole('button');
		// Find button by icon or class 'tour-evento-btn'
		const eventoContainer = document.querySelector('.tour-evento-btn');
		const eventoBtn = eventoContainer?.querySelector('button') ?? allButtons[1];

		await user.click(eventoBtn);

		expect(screen.getByText('Reporta un evento')).toBeInTheDocument();
	});

	it('opens verification modal when active slot is clicked and employee is verified', async () => {
		const user = userEvent.setup();

		render(
			<EmployeeCard
				empleado={mockEmpleado}
				catalogos={mockCatalogos}
				normas={mockNormas}
				acciones={mockAcciones}
			/>,
		);

		const comenzarBtn = screen.getByRole('button', {
			name: /Comenzar Jornada/i,
		});
		await user.click(comenzarBtn);

		// Verification modal is triggered since normas are already accepted
		expect(screen.getByTestId('mock-verification-modal')).toBeInTheDocument();
	});
});
