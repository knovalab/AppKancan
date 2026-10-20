import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HorasExtrasTabla } from '@/apps/horarios/components/horas-extras/HorasExtrasTabla';
import type { HoraExtraFila } from '@/apps/horarios/interfaces/horasExtras';

const fila: HoraExtraFila = {
	id: 1,
	fecha: '2026-10-10',
	empleado: 'Ana Pérez',
	documento: '1 107',
	tiendaId: 26,
	tienda: 'Ipiales Centro',
	rotacion: true,
	minutos: 90,
	observacion: 'Inventario',
	estado: 'pendiente',
	creadaPor: 'Luis Gómez',
	creadaEl: '2026-10-11T14:00:00',
};

describe('HorasExtrasTabla', () => {
	it('pinta la fila con horas, estado e indicadores', () => {
		render(<HorasExtrasTabla filas={[fila]} />);
		expect(screen.getByText('10/10/2026')).toBeInTheDocument();
		expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
		expect(screen.getByText('1 h 30 min')).toBeInTheDocument();
		expect(screen.getByText('Pendiente')).toBeInTheDocument();
		expect(screen.getByText('Rotación')).toBeInTheDocument();
	});

	it('muestra el estado vacío y el de carga', () => {
		const { rerender } = render(<HorasExtrasTabla filas={[]} vacio="No hay horas extras pendientes" />);
		expect(screen.getByText('No hay horas extras pendientes')).toBeInTheDocument();
		rerender(<HorasExtrasTabla filas={[]} loading />);
		expect(screen.getByText('Cargando horas extras...')).toBeInTheDocument();
	});
});
