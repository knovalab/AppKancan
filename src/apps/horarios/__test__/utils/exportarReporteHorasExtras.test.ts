import { describe, expect, it } from 'vitest';
import { exportarReporteTiempoRealExcel } from '@/apps/horarios/utils/exportarReporteHorasExtras';

const cero = { registros: 0, minutos: 0 };

describe('exportarReporteTiempoRealExcel', () => {
	it('rechaza un periodo preliquidado (números preliminares)', async () => {
		const r = {
			periodo: { id: 2, name: 'Oct 2', start_date: '2026-10-11', end_date: '2026-10-25', status: 'preliquidado' },
			delPeriodo: cero,
			rezagadas: cero,
			total: cero,
			tiendas: [],
		};
		await expect(
			exportarReporteTiempoRealExcel(r as never, () => ({ name: '' }), ''),
		).rejects.toThrow('Solo se pueden exportar periodos liquidados');
	});
});
