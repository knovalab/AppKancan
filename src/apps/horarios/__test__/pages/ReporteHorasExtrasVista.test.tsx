import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Rol } from '@/apps/horarios/navigation/secciones';

let roles: Rol[] = [];
vi.mock('@/apps/horarios/hooks/useHorariosLayout', () => ({
	useHorariosLayout: () => ({
		acceso: { roles: new Set(roles), tiendasPermitidas: [{ id: 26, name: 'Ipiales' }] },
	}),
}));
vi.mock('@/apps/horarios/pages/reporte/ReporteHorasExtrasTab', () => ({ default: () => <div>TIEMPO REAL</div> }));
vi.mock('@/apps/horarios/pages/reporte/ReporteZonaTab', () => ({
	default: ({ tiendasJefe }: { tiendasJefe: number[] | null }) => <div>ZONA {JSON.stringify(tiendasJefe)}</div>,
}));

vi.mock('@/apps/horarios/pages/reporte/gerencia/ReporteGerencia', () => ({ default: () => <div>GERENCIA</div> }));

import ReporteHorasExtrasVista from '@/apps/horarios/pages/reporte/ReporteHorasExtrasVista';

const montar = (r: Rol[]) => {
	roles = r;
	render(<ReporteHorasExtrasVista />);
};

describe('Reportes · Horas extras: pestañas por rol', () => {
	it('jefe de zona: solo Por zona, con sus tiendas', () => {
		montar(['areaManager', 'report']);
		expect(screen.getByText('ZONA [26]')).toBeInTheDocument();
		expect(screen.queryByRole('tab')).not.toBeInTheDocument();
	});
	it('nómina: solo Tiempo real', () => {
		montar(['tienda', 'nomina']);
		expect(screen.getByText('TIEMPO REAL')).toBeInTheDocument();
		expect(screen.queryByRole('tab')).not.toBeInTheDocument();
	});
	it('gerencia: su propio reporte (sin personas)', () => {
		montar(['gerencia']);
		expect(screen.getByText('GERENCIA')).toBeInTheDocument();
		expect(screen.queryByText(/ZONA|TIEMPO REAL/)).not.toBeInTheDocument();
	});
	it('gerencia + comercial: manda comercial (ve más)', () => {
		montar(['gerencia', 'comercial']);
		expect(screen.queryByText('GERENCIA')).not.toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Tiempo real' })).toBeInTheDocument();
	});
	it('comercial: las dos; Por zona sin tiendas fijas (elige zona)', () => {
		montar(['tienda', 'comercial']);
		expect(screen.getByRole('tab', { name: 'Tiempo real' })).toBeInTheDocument();
		fireEvent.click(screen.getByRole('tab', { name: 'Por zona' }));
		expect(screen.getByText('ZONA null')).toBeInTheDocument();
	});
});
