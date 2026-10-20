import type React from 'react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import Joyride, {
	ACTIONS,
	type CallBackProps,
	EVENTS,
	STATUS,
} from 'react-joyride';
import {
	FakeVerificationModal,
	verificationModalTargets,
} from './FakeVerificationModal';
import {
	exportHistorialModalTargets,
	exportModalTargets,
	exportNovedadesModalTargets,
	FakeExportHistorialModal,
	FakeExportModal,
	FakeExportNovedadesModal,
} from './fakeExportModals';
import {
	countdownTargets,
	eventoModalTargets,
	FakeCountdownCard,
	FakeEventoModal,
	FakeNovedadModal,
	novedadModalTargets,
} from './fakeTourModals';
import { useHorariosTour } from './HorariosTourContext';
import { CustomTooltip } from './TourTooltip';
import { STEPS_BY_PHASE } from './tourSteps';

type OverlayKind =
	| 'verificacion'
	| 'novedad'
	| 'evento'
	| 'countdown'
	| 'exportar'
	| 'exportarNov'
	| 'exportarHist'
	| null;

const getOverlayForTarget = (target?: string | null): OverlayKind => {
	if (!target) return null;
	if (verificationModalTargets.includes(target)) return 'verificacion';
	if (novedadModalTargets.includes(target)) return 'novedad';
	if (eventoModalTargets.includes(target)) return 'evento';
	if (countdownTargets.includes(target)) return 'countdown';
	if (exportModalTargets.includes(target)) return 'exportar';
	if (exportNovedadesModalTargets.includes(target)) return 'exportarNov';
	if (exportHistorialModalTargets.includes(target)) return 'exportarHist';
	return null;
};

interface HorariosTourProps {
	children: ReactNode;
}

export const HorariosTour: React.FC<HorariosTourProps> = ({ children }) => {
	const { tourPhase, stepIndex, setStepIndex, nextPhase, stopTour } =
		useHorariosTour();

	const [runTour, setRunTour] = useState(false);
	const [activeOverlay, setActiveOverlay] = useState<OverlayKind>(null);
	const [joyrideKey, setJoyrideKey] = useState(0);
	const [pendingStepIndex, setPendingStepIndex] = useState<number | null>(null);

	const currentSteps = STEPS_BY_PHASE[tourPhase] || [];

	useEffect(() => {
		if (
			tourPhase !== 'IDLE' &&
			tourPhase !== 'COMPLETED' &&
			currentSteps.length > 0
		) {
			setActiveOverlay(null);
			const timer = setTimeout(() => setRunTour(true), 250);
			return () => clearTimeout(timer);
		}

		setRunTour(false);
		setActiveOverlay(null);
		setPendingStepIndex(null);
	}, [tourPhase, currentSteps.length]);

	useEffect(() => {
		if (
			tourPhase !== 'REGISTROS' &&
			tourPhase !== 'NOVEDADES' &&
			tourPhase !== 'HISTORIAL'
		) {
			setActiveOverlay(null);
			return;
		}

		const step = currentSteps[stepIndex];
		if (!step) {
			setActiveOverlay(null);
			return;
		}

		const nextOverlay = getOverlayForTarget(step.target as string | undefined);
		setActiveOverlay(nextOverlay);
	}, [tourPhase, stepIndex, currentSteps]);

	useEffect(() => {
		if (!activeOverlay || pendingStepIndex === null) return;

		let raf1 = 0;
		let raf2 = 0;

		raf1 = window.requestAnimationFrame(() => {
			raf2 = window.requestAnimationFrame(() => {
				setJoyrideKey((k) => k + 1);
				setStepIndex(pendingStepIndex);
				setPendingStepIndex(null);
			});
		});

		return () => {
			window.cancelAnimationFrame(raf1);
			window.cancelAnimationFrame(raf2);
		};
	}, [activeOverlay, pendingStepIndex, setStepIndex]);

	useEffect(() => {
		if (activeOverlay && runTour && stepIndex !== undefined) {
			const timer = setTimeout(() => {
				window.dispatchEvent(new Event('resize'));
			}, 150);
			return () => clearTimeout(timer);
		}
	}, [stepIndex, activeOverlay, runTour]);

	const handleJoyrideCallback = useCallback(
		(data: CallBackProps) => {
			const { status, action, type, index } = data;

			if (status === STATUS.FINISHED) {
				setRunTour(false);
				setActiveOverlay(null);
				setPendingStepIndex(null);
				nextPhase();
				return;
			}

			if (status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
				setRunTour(false);
				setActiveOverlay(null);
				setPendingStepIndex(null);
				stopTour();
				return;
			}

			if (
				type === EVENTS.STEP_AFTER &&
				(action === ACTIONS.NEXT || action === ACTIONS.PREV)
			) {
				const targetIndex = action === ACTIONS.NEXT ? index + 1 : index - 1;
				const targetStep = currentSteps[targetIndex];
				const overlayNeeded = getOverlayForTarget(
					targetStep?.target as string | undefined,
				);

				if (overlayNeeded && overlayNeeded !== activeOverlay) {
					setActiveOverlay(overlayNeeded);
					setPendingStepIndex(targetIndex);
					return;
				}

				if (!overlayNeeded && activeOverlay) {
					setActiveOverlay(null);
				}

				setStepIndex(targetIndex);
			}
		},
		[activeOverlay, currentSteps, nextPhase, stopTour, setStepIndex],
	);

	return (
		<>
			{children}
			<FakeVerificationModal
				open={activeOverlay === 'verificacion'}
				activeField={currentSteps[stepIndex]?.target as string | null}
			/>
			<FakeNovedadModal
				open={activeOverlay === 'novedad'}
				activeField={currentSteps[stepIndex]?.target as string | null}
			/>
			<FakeEventoModal
				open={activeOverlay === 'evento'}
				activeField={currentSteps[stepIndex]?.target as string | null}
			/>
			<FakeCountdownCard open={activeOverlay === 'countdown'} />
			<FakeExportModal
				open={activeOverlay === 'exportar'}
				activeField={currentSteps[stepIndex]?.target as string | null}
			/>
			<FakeExportNovedadesModal
				open={activeOverlay === 'exportarNov'}
				activeField={currentSteps[stepIndex]?.target as string | null}
			/>
			<FakeExportHistorialModal
				open={activeOverlay === 'exportarHist'}
				activeField={currentSteps[stepIndex]?.target as string | null}
			/>

			<Joyride
				run={runTour}
				key={`${joyrideKey}-${tourPhase}`}
				steps={currentSteps}
				stepIndex={stepIndex}
				callback={handleJoyrideCallback}
				continuous
				showSkipButton
				showProgress
				disableOverlayClose
				disableScrollParentFix
				disableScrolling
				spotlightClicks
				tooltipComponent={CustomTooltip}
				styles={{
					options: {
						zIndex: 10000,
						arrowColor: '#fff',
						overlayColor: 'rgba(0, 0, 0, 0.5)',
					},
					overlay: {
						transition: 'none',
					},
					spotlight: {
						borderRadius: 8,
						boxShadow: '0 0 0 3px #004680, 0 0 25px rgba(0, 74, 153, 0.4)',
						transition: 'all 0.2s ease-in-out',
					},
					buttonClose: { display: 'none' },
					buttonBack: { display: 'none' },
					buttonNext: { display: 'none' },
					buttonSkip: { display: 'none' },
				}}
				floaterProps={{ disableAnimation: true }}
				locale={{
					back: 'Atrás',
					close: 'Cerrar',
					last: 'Continuar',
					next: 'Siguiente',
					skip: 'Salir del tour',
				}}
			/>
		</>
	);
};

export default HorariosTour;
