import type React from 'react';
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BASE } from '../../navigation/secciones';

export type TourPhase =
	| 'IDLE'
	| 'REGISTROS'
	| 'NOVEDADES'
	| 'HISTORIAL'
	| 'COMPLETED';

interface TourContextType {
	tourPhase: TourPhase;
	isFullTourRunning: boolean;
	stepIndex: number;

	startTour: (phase?: TourPhase) => void;
	nextPhase: () => void;
	setStepIndex: (index: number) => void;
	stopTour: () => void;
}

const HorariosTourContext = createContext<TourContextType | undefined>(
	undefined,
);

const PHASE_ORDER: TourPhase[] = [
	'REGISTROS',
	'NOVEDADES',
	'HISTORIAL',
	'COMPLETED',
];

/** Sección (relativa a /horarios) que debe estar visible en cada fase del tour. */
const PHASE_ROUTE: Partial<Record<TourPhase, string>> = {
	REGISTROS: 'registros',
	NOVEDADES: 'novedades',
	HISTORIAL: 'historial',
};

interface TourProviderProps {
	children: ReactNode;
}

export const HorariosTourProvider: React.FC<TourProviderProps> = ({
	children,
}) => {
	const [tourPhase, setTourPhase] = useState<TourPhase>('IDLE');
	const [stepIndex, setStepIndex] = useState(0);

	const location = useLocation();
	const navigate = useNavigate();

	// Navega a la sección de la fase conservando los query params (?tienda=).
	const irAFase = useCallback(
		(phase: TourPhase) => {
			const ruta = PHASE_ROUTE[phase];
			if (!ruta) return;
			const params = new URLSearchParams(location.search);
			params.delete('tour');
			const search = params.toString();
			navigate({
				pathname: `${BASE}/${ruta}`,
				search: search ? `?${search}` : '',
			});
		},
		[location.search, navigate],
	);

	const isFullTourRunning = tourPhase !== 'IDLE' && tourPhase !== 'COMPLETED';

	const startTour = useCallback(
		(phase: TourPhase = 'REGISTROS') => {
			// Prefetch lazy sections the tour will navigate to
			import('../../pages/secciones/NovedadesSeccion');
			import('../../pages/secciones/HistorialSeccion');
			window.scrollTo(0, 0);
			setStepIndex(0);
			irAFase(phase);
			setTimeout(() => setTourPhase(phase), 100);
		},
		[irAFase],
	);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		if (params.get('tour') === 'start' && !isFullTourRunning) {
			startTour();
		}
	}, [location.search, startTour, isFullTourRunning]);

	const nextPhase = useCallback(() => {
		const currentIndex = PHASE_ORDER.indexOf(tourPhase);
		if (currentIndex < 0 || currentIndex >= PHASE_ORDER.length - 1) return;

		const nextPhaseValue = PHASE_ORDER[currentIndex + 1];
		setStepIndex(0);

		if (nextPhaseValue === 'COMPLETED') {
			setTourPhase('COMPLETED');
			setTimeout(() => setTourPhase('IDLE'), 400);
			return;
		}

		irAFase(nextPhaseValue);
		setTimeout(() => setTourPhase(nextPhaseValue), 400);
	}, [tourPhase, irAFase]);

	const stopTour = useCallback(() => {
		setTourPhase('IDLE');
		setStepIndex(0);
	}, []);

	// Mientras el tour corre (cualquier fase), anulamos el sticky del header
	// general para que no tape los targets al hacer scroll. Se retira al
	// terminar, cancelar, o pasar a COMPLETED/IDLE.
	useEffect(() => {
		if (!isFullTourRunning) return;
		const style = document.createElement('style');
		style.id = 'horarios-tour-sticky-override';
		style.innerHTML = '.tour-sticky-header { position: static !important; }';
		document.head.appendChild(style);
		return () => {
			document.getElementById('horarios-tour-sticky-override')?.remove();
		};
	}, [isFullTourRunning]);

	return (
		<HorariosTourContext.Provider
			value={{
				tourPhase,
				isFullTourRunning,
				stepIndex,
				startTour,
				nextPhase,
				setStepIndex,
				stopTour,
			}}
		>
			{children}
		</HorariosTourContext.Provider>
	);
};

export const useHorariosTour = (): TourContextType => {
	const context = useContext(HorariosTourContext);
	if (!context) {
		throw new Error(
			'useHorariosTour debe usarse dentro de HorariosTourProvider',
		);
	}
	return context;
};

export default HorariosTourContext;
