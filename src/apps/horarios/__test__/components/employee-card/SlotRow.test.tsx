import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlotRow } from '@/apps/horarios/components/employee-card/slots/SlotRow';
import {
	type EstadoMarcacion,
	MARCACIONES,
} from '@/apps/horarios/domain/registro';

describe('SlotRow', () => {
	const mockOnRegistrar = vi.fn();
	const mockOnEditarHora = vi.fn();
	const mockOnObservar = vi.fn();
	const mockOnSinAlmuerzo = vi.fn();

	const baseEstado: EstadoMarcacion = {
		marcacion: MARCACIONES[0], // inicioJornada ("Comenzar Jornada")
		hora: null,
		activa: true,
		hecha: false,
		deshabilitada: false,
		registrable: true,
		editable: false,
		editada: false,
		observable: false,
		observacion: '',
		permiteSinAlmuerzo: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render active slot ready for registration and handle mark click', () => {
		render(
			<SlotRow
				estado={baseEstado}
				guardando={false}
				ocupado={false}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		const markBtn = screen.getByRole('button', {
			name: /Comenzar Jornada/i,
		});
		expect(markBtn).toBeEnabled();

		fireEvent.click(markBtn);
		expect(mockOnRegistrar).toHaveBeenCalledWith('Comenzar Jornada');
	});

	it('should render completed slot with formatted time and checkmark', () => {
		const estadoHecha: EstadoMarcacion = {
			...baseEstado,
			activa: false,
			hecha: true,
			hora: '08:30:00',
			editable: true,
			observable: true,
		};

		render(
			<SlotRow
				estado={estadoHecha}
				guardando={false}
				ocupado={false}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		expect(screen.getByText('08:30 AM')).toBeInTheDocument();

		const markBtn = screen.getByRole('button', {
			name: /Comenzar Jornada/i,
		});
		fireEvent.click(markBtn);
		expect(mockOnRegistrar).not.toHaveBeenCalled();
	});

	it('should render spinner when guardando is true', () => {
		render(
			<SlotRow
				estado={baseEstado}
				guardando={true}
				ocupado={true}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		expect(screen.getByRole('progressbar')).toBeInTheDocument();
	});

	it('should disable button when ocupado is true or deshabilitada is true', () => {
		render(
			<SlotRow
				estado={{ ...baseEstado, deshabilitada: true, registrable: false }}
				guardando={false}
				ocupado={false}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		const markBtn = screen.getByRole('button', {
			name: /Comenzar Jornada/i,
		});
		expect(markBtn).toBeDisabled();
	});

	it('should enable edit hour button when editable is true and handle click', () => {
		const estadoEditable: EstadoMarcacion = {
			...baseEstado,
			hecha: true,
			hora: '08:00',
			editable: true,
		};

		render(
			<SlotRow
				estado={estadoEditable}
				guardando={false}
				ocupado={false}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		const buttons = screen.getAllByRole('button');
		const editBtn = buttons[0]; // AccessTimeIcon button is the first button in row
		expect(editBtn).toBeEnabled();

		fireEvent.click(editBtn);
		expect(mockOnEditarHora).toHaveBeenCalledWith('Comenzar Jornada');
	});

	it('should render "Turno sin almuerzo" button when permiteSinAlmuerzo is true', () => {
		const estadoSinAlmuerzo: EstadoMarcacion = {
			...baseEstado,
			marcacion: MARCACIONES[1], // inicioAlmuerzo
			permiteSinAlmuerzo: true,
		};

		render(
			<SlotRow
				estado={estadoSinAlmuerzo}
				guardando={false}
				ocupado={false}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		const buttons = screen.getAllByRole('button');
		const sinAlmuerzoBtn = buttons[buttons.length - 1]; // last button is NoFoodIcon

		fireEvent.click(sinAlmuerzoBtn);
		expect(mockOnSinAlmuerzo).toHaveBeenCalledTimes(1);
	});

	it('should render observation button and handle click when observable is true', () => {
		const estadoObservable: EstadoMarcacion = {
			...baseEstado,
			hecha: true,
			hora: '08:00',
			observable: true,
			observacion: 'Llegada con lluvia',
		};

		render(
			<SlotRow
				estado={estadoObservable}
				guardando={false}
				ocupado={false}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		const buttons = screen.getAllByRole('button');
		const obsBtn = buttons[buttons.length - 1]; // last button is AssignmentIcon

		expect(obsBtn).toBeEnabled();
		fireEvent.click(obsBtn);
		expect(mockOnObservar).toHaveBeenCalledWith('Comenzar Jornada');
	});
});
