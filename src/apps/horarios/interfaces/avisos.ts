import type { ReactNode } from 'react';

/** Mismos tipos de aviso que el snackbar global (shared/components/SnackbarsPosition). */
export type SeveridadAviso = 'success' | 'error' | 'warning' | 'info';

export interface AvisosValue {
	/** Muestra un aviso flotante. `detalle` va debajo del mensaje (p. ej. una tarjeta). */
	showSnackbar: (
		message: string,
		severity?: SeveridadAviso,
		detalle?: ReactNode,
	) => void;
}
