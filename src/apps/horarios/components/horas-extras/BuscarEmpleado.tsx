import SearchIcon from '@mui/icons-material/Search';
import { InputAdornment, TextField } from '@mui/material';

/** Buscador de empleado por nombre o documento (ver `coincideEmpleado`). */
export function BuscarEmpleado({
	value,
	onChange,
}: {
	value: string;
	onChange: (texto: string) => void;
}) {
	return (
		<TextField
			size="small"
			label="Buscar empleado"
			placeholder="Nombre o documento"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			slotProps={{
				input: {
					startAdornment: (
						<InputAdornment position="start">
							<SearchIcon fontSize="small" />
						</InputAdornment>
					),
				},
			}}
			sx={{ minWidth: 240 }}
		/>
	);
}
