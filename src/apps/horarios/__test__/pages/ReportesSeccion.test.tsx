import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Rol } from '@/apps/horarios/navigation/secciones';

let roles: Rol[] = [];
vi.mock('@/apps/horarios/hooks/useHorariosLayout', () => ({
	useHorariosLayout: () => ({
		tienda: { storeId: null, setSeleccion: vi.fn() },
		acceso: {
			roles: new Set(roles),
			puede: (r: readonly Rol[]) => r.some((x) => roles.includes(x)),
			tiendasPermitidas: [],
		},
	}),
}));
vi.mock('@/apps/horarios/pages/ReportePage', () => ({ default: () => <div>REPORTE ASISTENCIA</div> }));
vi.mock('@/apps/horarios/pages/reporte/ReporteHorasExtrasVista', () => ({ default: () => <div>REPORTE HORAS EXTRAS</div> }));

import ReportesSeccion from '@/apps/horarios/pages/secciones/ReportesSeccion';

const montar = (r: Rol[], url = '/horarios/reportes') => {
	roles = r;
	render(
		<MemoryRouter initialEntries={[url]}>
			<ReportesSeccion />
		</MemoryRouter>,
	);
};

describe('Reportes: vistas por rol', () => {
	it('comercial o nómina: solo Horas extras, sin pestañas', async () => {
		montar(['tienda', 'comercial']);
		expect(await screen.findByText('REPORTE HORAS EXTRAS')).toBeInTheDocument();
		expect(screen.queryByRole('tab')).not.toBeInTheDocument();
	});

	it('jefe de zona: Asistencia (por defecto) y Horas extras de su zona', () => {
		montar(['areaManager', 'report']);
		expect(screen.getByText('REPORTE ASISTENCIA')).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: 'Horas extras' })).toBeInTheDocument();
	});

	it('report + comercial: las dos vistas; ?vista= elige', async () => {
		montar(['report', 'comercial'], '/horarios/reportes?vista=horas-extras');
		expect(screen.getByRole('tab', { name: 'Asistencia' })).toBeInTheDocument();
		expect(await screen.findByText('REPORTE HORAS EXTRAS')).toBeInTheDocument();
	});
});
