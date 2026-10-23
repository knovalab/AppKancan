import { Alert, Box, Snackbar } from '@mui/material';
import {
	type ReactNode,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { SILEO_STATE_FILL } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { AvisosContext } from '../../hooks/useAvisos';
import type { SeveridadAviso } from '../../interfaces/avisos';

interface Aviso {
	id: number;
	message: string;
	severity: SeveridadAviso;
	detalle?: ReactNode;
}

const duracion = (a: Aviso) =>
	a.severity === 'error' ? 8000 : a.detalle ? 6000 : 4000;

let siguienteId = 0;

/**
 * Avisos flotantes de Horarios con MUI (sustituye a Sileo solo en esta app):
 * el texto largo hace salto de línea y en móvil ocupa el ancho de la pantalla.
 * MUI muestra un aviso a la vez: si llega otro, el actual se cierra y entra el siguiente.
 */
export function AvisosProvider({ children }: { children: ReactNode }) {
	const [cola, setCola] = useState<Aviso[]>([]);
	const [actual, setActual] = useState<Aviso | null>(null);
	const [abierto, setAbierto] = useState(false);

	const showSnackbar = useCallback(
		(
			message: string,
			severity: SeveridadAviso = 'info',
			detalle?: ReactNode,
		) => {
			setCola((c) => [...c, { id: ++siguienteId, message, severity, detalle }]);
		},
		[],
	);

	useEffect(() => {
		if (cola.length && !actual) {
			setActual(cola[0]);
			setCola((c) => c.slice(1));
			setAbierto(true);
		} else if (cola.length && actual && abierto) {
			setAbierto(false);
		}
	}, [cola, actual, abierto]);

	const cerrar = (_?: SyntheticEvent | Event, reason?: string) => {
		if (reason === 'clickaway') return;
		setAbierto(false);
	};

	const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

	return (
		<AvisosContext.Provider value={value}>
			{children}
			{actual && (
				<Snackbar
					key={actual.id}
					open={abierto}
					onClose={cerrar}
					autoHideDuration={duracion(actual)}
					anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
					slotProps={{ transition: { onExited: () => setActual(null) } }}
				>
					<Alert
						variant="filled"
						severity={actual.severity}
						onClose={cerrar}
						role={actual.severity === 'error' ? 'alert' : 'status'}
						sx={{
							maxWidth: 480,
							alignItems: 'flex-start',
							bgcolor: SILEO_STATE_FILL[actual.severity],
							color: '#fff',
							'& .MuiAlert-icon': { color: '#fff' },
						}}
					>
						{actual.message}
						{actual.detalle && <Box sx={{ mt: 1 }}>{actual.detalle}</Box>}
					</Alert>
				</Snackbar>
			)}
		</AvisosContext.Provider>
	);
}
