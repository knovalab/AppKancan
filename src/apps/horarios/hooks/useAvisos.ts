import { createContext, useContext } from 'react';
import type { AvisosValue } from '../interfaces/avisos';

export const AvisosContext = createContext<AvisosValue | null>(null);

/** Avisos flotantes de Horarios (MUI Snackbar + Alert). Requiere <AvisosProvider>. */
export function useAvisos(): AvisosValue {
	const ctx = useContext(AvisosContext);
	if (!ctx) throw new Error('useAvisos debe usarse dentro de <AvisosProvider>');
	return ctx;
}
