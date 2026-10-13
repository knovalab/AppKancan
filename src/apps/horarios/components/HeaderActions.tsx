import { Box } from '@mui/material';
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useMemo,
	useState,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Slots del layout para que cada página ponga sus propias acciones sin que el
 * layout tenga que conocerlas. Se desmontan solas al salir de la página.
 *
 * - `header`: dentro del grupo de botones del header (entre Normas y Tutorial).
 * - `tabs`: al final de la fila de pestañas.
 */
export type SlotAcciones = 'header' | 'tabs';

type Nodos = Partial<Record<SlotAcciones, HTMLElement | null>>;

const HeaderActionsContext = createContext<{
	nodos: Nodos;
	registrar: (slot: SlotAcciones, nodo: HTMLElement | null) => void;
} | null>(null);

export function HeaderActionsProvider({ children }: PropsWithChildren) {
	const [nodos, setNodos] = useState<Nodos>({});
	const registrar = useCallback(
		(slot: SlotAcciones, nodo: HTMLElement | null) =>
			setNodos((prev) =>
				prev[slot] === nodo ? prev : { ...prev, [slot]: nodo },
			),
		[],
	);
	const value = useMemo(() => ({ nodos, registrar }), [nodos, registrar]);
	return (
		<HeaderActionsContext.Provider value={value}>
			{children}
		</HeaderActionsContext.Provider>
	);
}

/** Dónde se pintan las acciones del slot. Lo usan `HorariosHeader` y `HorariosTabs`. */
export function HeaderActionsSlot({ slot }: { slot: SlotAcciones }) {
	const ctx = useContext(HeaderActionsContext);
	const registrar = ctx?.registrar;
	const ref = useCallback(
		(nodo: HTMLElement | null) => registrar?.(slot, nodo),
		[registrar, slot],
	);
	return (
		<Box
			ref={ref}
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				'&:empty': { display: 'none' },
			}}
		/>
	);
}

/**
 * Lo usa cada página:
 * ```tsx
 * <HeaderActions slot="tabs"><Button>Exportar</Button></HeaderActions>
 * ```
 */
export function HeaderActions({
	slot = 'header',
	children,
}: PropsWithChildren<{ slot?: SlotAcciones }>) {
	const nodo = useContext(HeaderActionsContext)?.nodos[slot];
	return nodo ? createPortal(children, nodo) : null;
}
