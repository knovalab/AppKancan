import { Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
import GerenciaPorZona from './GerenciaPorZona';
import GerenciaTiempoReal from './GerenciaTiempoReal';

/**
 * Reportes → Horas extras para gerencia: Tiempo real y Por zona, sin personas ni
 * descargas. Pestañas a todo el ancho en teléfono.
 */
export default function ReporteGerencia() {
	const telefono = useMediaQuery(useTheme().breakpoints.down('sm'));
	const [pestana, setPestana] = useState<'tiempo-real' | 'zona'>('tiempo-real');
	return (
		<>
			<Tabs
				value={pestana}
				onChange={(_, v: 'tiempo-real' | 'zona') => setPestana(v)}
				variant={telefono ? 'fullWidth' : 'standard'}
				aria-label="Reporte de horas extras"
				sx={{ mb: 2 }}
			>
				<Tab value="tiempo-real" label="Tiempo real" />
				<Tab value="zona" label="Por zona" />
			</Tabs>
			{pestana === 'tiempo-real' ? <GerenciaTiempoReal /> : <GerenciaPorZona />}
		</>
	);
}
