import { useAuth } from '@/auth/hooks/useAuth';

interface HorariosPolicies {
	hasPolicy: (policyName: string) => boolean;
	esAdmin: () => boolean;
	esAreaManager: () => boolean; // Lider
	esReport: () => boolean;
	esComercial: () => boolean;
	tieneTemporal: () => boolean;
	puedeVerDemo: () => boolean;
}

export const useHorariosPolicies = (): HorariosPolicies => {
	const { user } = useAuth();

	const hasPolicy = (policyName: string): boolean =>
		user?.policies?.includes(policyName) ?? false;

	const MODULO_REGEX = /(time_?log|horario)/;
	const esAdmin = (): boolean =>
		(user?.policies ?? []).some((p) => {
			const s = p.toLowerCase();
			return s.includes('admin') && MODULO_REGEX.test(s);
		});

	const esAreaManager = (): boolean =>
		(user?.policies ?? []).some((p) => {
			const s = p.toLowerCase();
			const hasTimeLog =
				s.includes('time_log') ||
				s.includes('time-log') ||
				s.includes('timelog');
			const hasManagerOrArea = s.includes('manager') || s.includes('area');
			return hasTimeLog && hasManagerOrArea;
		});

	const esReport = (): boolean =>
		(user?.policies ?? []).some((p) => {
			const s = p.toLowerCase();
			return s.includes('report') || esAreaManager();
		});

	// Exige el módulo para no confundirla con políticas "comercial" de otras apps.
	const esComercial = (): boolean =>
		(user?.policies ?? []).some((p) => {
			const s = p.toLowerCase();
			return s.includes('comercial') && MODULO_REGEX.test(s);
		});

	const tieneTemporal = (): boolean =>
		(user?.policies ?? []).some((p) => p.toLowerCase() === 'temporal');

	const puedeVerDemo = (): boolean =>
		(user?.policies ?? []).some((p) => p.toLowerCase().includes('demo'));

	return {
		hasPolicy,
		esAdmin,
		esReport,
		esComercial,
		puedeVerDemo,
		tieneTemporal,
		esAreaManager,
	};
};

export default useHorariosPolicies;
