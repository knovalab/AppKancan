import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeSlots } from '@/apps/horarios/components/employee-card/slots/TimeSlots';
import {
	calcularVistaTarjeta,
	crearRegistrosVacios,
	ESTADO,
} from '@/apps/horarios/domain/registro';

describe('TimeSlots', () => {
	const mockOnRegistrar = vi.fn();
	const mockOnEditarHora = vi.fn();
	const mockOnObservar = vi.fn();
	const mockOnSinAlmuerzo = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render all 4 marking slot rows', () => {
		const emptyRegs = crearRegistrosVacios();
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.entradaPendiente,
				registros: emptyRegs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<TimeSlots
				vm={vm}
				guardando={null}
				pausaExpiraEn={null}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

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

	it('should render ContadorPausa when an active pause is in progress', () => {
		const emptyRegs = crearRegistrosVacios();
		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.jornadaIniciada,
				registros: emptyRegs,
				pausasActivasCount: 0,
			},
			{
				pausaEnCurso: true,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<TimeSlots
				vm={vm}
				guardando={null}
				pausaExpiraEn={Date.now() + 180000}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		expect(screen.getByText('Pausas Activas')).toBeInTheDocument();
	});

	it('should render "Jornada completada" message when finalizado is true', () => {
		const regs = crearRegistrosVacios();
		regs.inicioJornada = '08:00';
		regs.inicioAlmuerzo = '12:00';
		regs.finAlmuerzo = '13:00';
		regs.finJornada = '17:00';

		const vm = calcularVistaTarjeta(
			{
				estadoActual: ESTADO.jornadaFinalizada,
				registros: regs,
				pausasActivasCount: 2,
			},
			{
				pausaEnCurso: false,
				almuerzoOmitido: false,
				normasPorAceptar: false,
			},
		);

		render(
			<TimeSlots
				vm={vm}
				guardando={null}
				pausaExpiraEn={null}
				onRegistrar={mockOnRegistrar}
				onEditarHora={mockOnEditarHora}
				onObservar={mockOnObservar}
				onSinAlmuerzo={mockOnSinAlmuerzo}
			/>,
		);

		expect(screen.getByText('Jornada completada')).toBeInTheDocument();
	});
});
