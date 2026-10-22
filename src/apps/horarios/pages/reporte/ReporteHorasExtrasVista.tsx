import { Paper, Tab, Tabs } from '@mui/material';
import { useState } from 'react';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import ReporteHorasExtrasTab from './ReporteHorasExtrasTab';
import ReporteZonaTab from './ReporteZonaTab';

/**
 * Reportes → Horas extras. Pestañas según el rol:
 * - **Tiempo real** (R1): comercial y nómina.
 * - **Por zona** (R2 + R4): jefe de zona (sus tiendas) y comercial (elige la zona).
 */
export default function ReporteHorasExtrasVista() {
	const { acceso } = useHorariosLayout();
	const comercial = acceso.roles.has('comercial');
	const nomina = acceso.roles.has('nomina');
	// Un jefe que además es comercial ve todas las zonas.
	const jefe = acceso.roles.has('areaManager') && !comercial;

	const pestanas = [
		...(comercial || nomina
			? [{ id: 'tiempo-real', label: 'Tiempo real' }]
			: []),
		...(comercial || jefe ? [{ id: 'zona', label: 'Por zona' }] : []),
	];
	const [pestana, setPestana] = useState(pestanas[0]?.id ?? 'zona');

	return (
		// Mismo panel que las demás vistas de Reportes (ReportePage).
		<Paper
			elevation={0}
			sx={{
				p: { xs: 2, sm: 3 },
				borderRadius: 4,
				border: '1px solid #e2e8f0',
				boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
				bgcolor: '#fff',
			}}
		>
			{pestanas.length > 1 && (
				<Tabs
					value={pestana}
					onChange={(_, v: string) => setPestana(v)}
					aria-label="Reporte de horas extras"
					sx={{ mb: 2 }}
				>
					{pestanas.map((p) => (
						<Tab key={p.id} value={p.id} label={p.label} />
					))}
				</Tabs>
			)}
			{pestana === 'tiempo-real' ? (
				<ReporteHorasExtrasTab />
			) : (
				<ReporteZonaTab
					tiendasJefe={
						jefe ? acceso.tiendasPermitidas.map((t) => Number(t.id)) : null
					}
				/>
			)}
		</Paper>
	);
}
