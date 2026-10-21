import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RevisionHoraExtraDialog } from '@/apps/horarios/components/horas-extras/RevisionHoraExtraDialog';
import type { HoraExtraFila } from '@/apps/horarios/interfaces/horasExtras';

const fila = (id: number, minutos: number): HoraExtraFila => ({
	id,
	fecha: '2026-10-19',
	empleado: `Asesor ${id}`,
	documento: '',
	tiendaId: 26,
	tienda: 'Ipiales',
	rotacion: false,
	minutos,
	observacion: '',
	estado: 'pendiente',
	creadaPor: '',
	creadaEl: '',
	empleadoId: id,
	periodoId: null,
});

describe('RevisionHoraExtraDialog', () => {
	it('rechazar exige motivo y lo envía sin espacios', () => {
		const onConfirmar = vi.fn();
		render(
			<RevisionHoraExtraDialog decision="descartada_comercial" filas={[fila(1, 60)]} guardando={false} onClose={vi.fn()} onConfirmar={onConfirmar} />,
		);
		fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
		expect(screen.getByText('El motivo del rechazo es obligatorio')).toBeInTheDocument();
		expect(onConfirmar).not.toHaveBeenCalled();
		fireEvent.change(screen.getByLabelText('Motivo del rechazo'), { target: { value: '  sin soporte ' } });
		fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
		expect(onConfirmar).toHaveBeenCalledWith('sin soporte');
	});

	it('aprobar en lote muestra el resumen y no pide motivo', () => {
		const onConfirmar = vi.fn();
		render(
			<RevisionHoraExtraDialog decision="aprobada" filas={[fila(1, 60), fila(2, 30)]} guardando={false} onClose={vi.fn()} onConfirmar={onConfirmar} />,
		);
		expect(screen.getByText('2 horas extras · 1 h 30 min en total')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
		expect(onConfirmar).toHaveBeenCalledWith('');
	});
});
