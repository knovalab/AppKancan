import { Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import { useState } from 'react';
import GerenciaPorTienda from './GerenciaPorTienda';
import GerenciaPorZona from './GerenciaPorZona';
import GerenciaTendencia from './GerenciaTendencia';
import GerenciaTiempoReal from './GerenciaTiempoReal';

type Pestana = 'tiempo-real' | 'zona' | 'tienda' | 'tendencia';

/**
 * Reportes → Horas extras para gerencia: Tiempo real, Por zona, Por tienda y Tendencia, sin
 * personas ni descargas. Pestañas a todo el ancho en teléfono.
 */
export default function ReporteGerencia() {
	const telefono = useMediaQuery(useTheme().breakpoints.down('sm'));
	const [pestana, setPestana] = useState<Pestana>('tiempo-real');
	return (
		<>
			<Tabs
				value={pestana}
				onChange={(_, v: Pestana) => setPestana(v)}
				variant={telefono ? 'fullWidth' : 'standard'}
				aria-label="Reporte de horas extras"
				sx={{ mb: 2 }}
			>
				<Tab value="tiempo-real" label="Tiempo real" />
				<Tab value="zona" label="Por zona" />
				<Tab value="tienda" label="Por tienda" />
				<Tab value="tendencia" label="Tendencia" />
			</Tabs>
			{pestana === 'tiempo-real' ? (
				<GerenciaTiempoReal />
			) : pestana === 'zona' ? (
				<GerenciaPorZona />
			) : pestana === 'tienda' ? (
				<GerenciaPorTienda />
			) : (
				<GerenciaTendencia />
			)}
		</>
	);
}
