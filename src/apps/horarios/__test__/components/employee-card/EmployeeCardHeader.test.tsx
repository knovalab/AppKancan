import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeCardHeader } from '@/apps/horarios/components/employee-card/header/EmployeeCardHeader';
import {
	calcularVistaTarjeta,
	crearRegistrosVacios,
	ESTADO,
} from '@/apps/horarios/domain/registro';

describe('EmployeeCardHeader', () => {
	const mockOnAccion = vi.fn();
	const mockOnAceptarNormas = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render employee name, cargo, and status chip', () => {
		const regs = crearRegistrosVacios();
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.entradaPendiente,
				registros: regs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<EmployeeCardHeader
				nombre="Carlos Gómez"
				cargo="Vendedor Principal"
				vm={vm}
				onAccion={mockOnAccion}
				onAceptarNormas={mockOnAceptarNormas}
			/>,
		);

		expect(screen.getByText('Carlos Gómez')).toBeInTheDocument();
		expect(screen.getByText('Vendedor Principal')).toBeInTheDocument();
		expect(screen.getByText('ENTRADA PENDIENTE')).toBeInTheDocument();
	});

	it('should render pause progress status when pauses are visible', () => {
		const regs = crearRegistrosVacios();
		regs.inicioJornada = '08:00';
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.jornadaIniciada,
				registros: regs,
				pausasActivasCount: 1,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<EmployeeCardHeader
				nombre="Carlos Gómez"
				cargo="Cajero"
				vm={vm}
				onAccion={mockOnAccion}
				onAceptarNormas={mockOnAceptarNormas}
			/>,
		);

		expect(
			screen.getByText('Pausa activa 1 de 2 completada'),
		).toBeInTheDocument();
	});

	it('should render "Aceptar Normas" button when mostrarAceptarNormas is true and handle click', () => {
		const regs = crearRegistrosVacios();
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.entradaPendiente,
				registros: regs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: true,
			},
		);

		render(
			<EmployeeCardHeader
				nombre="Carlos Gómez"
				vm={vm}
				onAccion={mockOnAccion}
				onAceptarNormas={mockOnAceptarNormas}
			/>,
		);

		const btn = screen.getByRole('button', { name: /Aceptar Normas/i });
		expect(btn).toBeInTheDocument();

		fireEvent.click(btn);
		expect(mockOnAceptarNormas).toHaveBeenCalledTimes(1);
	});

	it('should render header actions and call onAccion on click', () => {
		const regs = crearRegistrosVacios();
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.entradaPendiente,
				registros: regs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<EmployeeCardHeader
				nombre="Carlos Gómez"
				vm={vm}
				onAccion={mockOnAccion}
				onAceptarNormas={mockOnAceptarNormas}
			/>,
		);

		// Novedad icon is available before jornada starts (vm.puedeRegistrarNovedad is true)
		const buttons = screen.getAllByRole('button');
		const novedadBtn = buttons[0];

		fireEvent.click(novedadBtn);
		expect(mockOnAccion).toHaveBeenCalledWith('novedad');
	});

	it('should render toggle button and trigger onToggleExpandir on click', () => {
		const mockToggle = vi.fn();
		const regs = crearRegistrosVacios();
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.entradaPendiente,
				registros: regs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<EmployeeCardHeader
				nombre="Carlos Gómez"
				vm={vm}
				expandida={true}
				onToggleExpandir={mockToggle}
				onAccion={mockOnAccion}
				onAceptarNormas={mockOnAceptarNormas}
			/>,
		);

		const toggleBtn = screen.getByRole('button', { name: /contraer tarjeta/i });
		expect(toggleBtn).toBeInTheDocument();

		fireEvent.click(toggleBtn);
		expect(mockToggle).toHaveBeenCalledTimes(1);
	});

	it('should show last record summary when collapsed and has records', () => {
		const regs = crearRegistrosVacios();
		regs.inicioJornada = '08:30';
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.jornadaIniciada,
				registros: regs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<EmployeeCardHeader
				nombre="Carlos Gómez"
				vm={vm}
				expandida={false}
				onToggleExpandir={vi.fn()}
				onAccion={mockOnAccion}
				onAceptarNormas={mockOnAceptarNormas}
			/>,
		);

		expect(screen.getByText(/Comenzar Jornada: 08:30/i)).toBeInTheDocument();
	});
});
