import StorefrontIcon from '@mui/icons-material/Storefront';
import { Autocomplete, Box, InputAdornment, TextField } from '@mui/material';
import { useHorariosLayout } from '../hooks/useHorariosLayout';

interface Opcion {
	id: number | null; // null = "Todas las tiendas"
	name: string;
}

const OPCION_TODAS: Opcion = { id: null, name: 'Todas las tiendas' };

/**
 * Selector de tienda del header. Se muestra según el `ModoTienda` de la sección activa
 * y solo si el usuario tiene más de una tienda para elegir.
 */
export function TiendaSelector() {
	const { seccion, acceso, tienda } = useHorariosLayout();
	const modo = seccion?.tienda ?? 'ninguno';

	if (
		modo === 'ninguno' ||
		seccion?.selectorEnHeader === false ||
		acceso.tiendasPermitidas.length <= 1
	)
		return null;

	const opciones: Opcion[] = [
		...(modo === 'una-o-todas' ? [OPCION_TODAS] : []),
		...acceso.tiendasPermitidas.map((t) => ({
			id: Number(t.id),
			name: t.name,
		})),
	];

	const valor =
		tienda.seleccion.tipo === 'todas'
			? OPCION_TODAS
			: (opciones.find((o) => o.id === tienda.storeId) ?? null);

	return (
		<Box data-tour="horarios-tienda-header">
			<Autocomplete
				size="small"
				options={opciones}
				value={valor}
				disableClearable={valor != null}
				getOptionLabel={(o) => o.name}
				isOptionEqualToValue={(a, b) => a.id === b.id}
				onChange={(_, o) => {
					if (!o) return;
					if (o.id == null) tienda.setSeleccion({ tipo: 'todas' });
					else if (o.id === acceso.tiendaPropia)
						tienda.setSeleccion({ tipo: 'propia' });
					else tienda.setSeleccion({ tipo: 'una', id: o.id });
				}}
				sx={{ width: { xs: '100%', sm: 250 } }}
				renderInput={(params) => (
					<TextField
						{...params}
						placeholder="Seleccionar tienda"
						slotProps={{
							input: {
								...params.InputProps,
								startAdornment: (
									<InputAdornment position="start">
										<StorefrontIcon sx={{ fontSize: 18, color: '#004680' }} />
									</InputAdornment>
								),
							},
						}}
						sx={{
							'& .MuiOutlinedInput-root': {
								borderRadius: 2,
								bgcolor: '#f1f7fe',
							},
						}}
					/>
				)}
			/>
		</Box>
	);
}
