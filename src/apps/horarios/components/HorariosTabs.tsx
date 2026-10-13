import { Box, Tab, Tabs } from '@mui/material';
import { useHorariosLayout } from '../hooks/useHorariosLayout';
import { HeaderActionsSlot } from './HeaderActions';

/**
 * Fila de pestañas principales (desde `SECCIONES`, filtradas por rol) con el slot
 * `tabs` alineado al final para acciones de la página (p. ej. Exportar y Total en Registros).
 */
export function HorariosTabs() {
	const { seccionesVisibles, seccion, irA } = useHorariosLayout();

	// Con una sola sección (p. ej. "solo reporte") no hay pestañas que elegir,
	// pero la fila se mantiene para las acciones de la página.
	const mostrarTabs = seccionesVisibles.length > 1;

	const activa = seccionesVisibles.some((s) => s.path === seccion?.path)
		? seccion?.path
		: false;

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: { xs: 'column', sm: 'row' },
				alignItems: { xs: 'stretch', sm: 'center' },
				gap: 1,
				px: { xs: 0.5, sm: 0 },
				pr: { sm: 2 },
			}}
		>
			{mostrarTabs && (
				<Tabs
					className="tour-tabs"
					value={activa}
					onChange={(_, path: string) => irA(path)}
					variant="scrollable"
					scrollButtons={false}
					slotProps={{ indicator: { sx: { display: 'none' } } }}
					sx={{
						px: { xs: 0, sm: 3 },
						py: { xs: 0.5, sm: 1 },
						minHeight: 'auto',
						minWidth: 0,
						flex: 1,
						'& .MuiTabs-flexContainer': { gap: { xs: 0.3, sm: 1 } },
						'& .MuiTab-root': {
							textTransform: 'none',
							fontWeight: 600,
							fontSize: { xs: '0.6rem', sm: '0.8rem' },
							letterSpacing: '0.2px',
							minHeight: { xs: 28, sm: 40 },
							borderRadius: '10px',
							px: { xs: 1, sm: 2 },
							py: { xs: 0.3, sm: 0.8 },
							color: '#64748b',
							transition: 'background-color 0.2s ease, color 0.2s ease',
							'& .MuiTab-iconWrapper': {
								mr: 0.3,
								fontSize: { xs: 14, sm: 18 },
							},
							'&:hover': { backgroundColor: '#eef4fb', color: '#004680' },
							'&.Mui-selected': { color: '#fff', backgroundColor: '#004680' },
							'&.Mui-selected:hover': { backgroundColor: '#003a6b' },
						},
					}}
				>
					{seccionesVisibles.map(({ path, label, icon: Icon }) => (
						<Tab
							key={path}
							value={path}
							label={label}
							icon={<Icon />}
							iconPosition="start"
						/>
					))}
				</Tabs>
			)}

			<Box
				sx={{
					ml: { sm: 'auto' },
					display: 'flex',
					justifyContent: { xs: 'center', sm: 'flex-end' },
					py: { xs: 0.5, sm: 1 },
					'&:has(> div:empty)': { display: 'none' },
				}}
			>
				<HeaderActionsSlot slot="tabs" />
			</Box>
		</Box>
	);
}
