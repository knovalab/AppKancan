import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/auth/hooks/AuthContext';
import { useAuth } from '@/auth/hooks/useAuth';
import { useHorariosPolicies } from '../../hooks/useHorariosPolicies';

vi.mock('@/auth/hooks/useAuth', () => ({
	useAuth: vi.fn(),
}));

describe('useHorariosPolicies', () => {
	const mockedUseAuth = vi.mocked(useAuth);

	const mockUserWithPolicies = (policies?: string[]): void => {
		const user: User = policies
			? {
					id: '1',
					email: 'test@kancan.com',
					nombre: 'Test',
					apellido: 'User',
					company: 'Kancan',
					ultra_code: 'U1',
					policies,
				}
			: null;

		mockedUseAuth.mockReturnValue({
			user,
			loading: false,
			isAuthenticated: !!user,
			login: vi.fn(),
			logout: vi.fn(),
		});
	};

	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe('when user is null or has no policies', () => {
		it('should return false for all policy checks', () => {
			mockUserWithPolicies(undefined);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.hasPolicy('any_policy')).toBe(false);
			expect(result.current.esAdmin()).toBe(false);
			expect(result.current.esAreaManager()).toBe(false);
			expect(result.current.esReport()).toBe(false);
			expect(result.current.tieneTemporal()).toBe(false);
			expect(result.current.puedeVerDemo()).toBe(false);
		});
	});

	describe('hasPolicy', () => {
		it('should check exact policy name presence', () => {
			mockUserWithPolicies(['horarios_consulta', 'inventario_ver']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.hasPolicy('horarios_consulta')).toBe(true);
			expect(result.current.hasPolicy('inventario_ver')).toBe(true);
			expect(result.current.hasPolicy('horarios_admin')).toBe(false);
		});
	});

	describe('esAdmin', () => {
		it('should return true when policy combines admin with time_log or horario module', () => {
			const validPolicies = [
				['time_log_admin'],
				['timelog_admin'],
				['admin_horarios'],
				['HORARIO_ADMIN'],
				['TIME_LOG_ADMIN'],
			];

			for (const policies of validPolicies) {
				mockUserWithPolicies(policies);
				const { result } = renderHook(() => useHorariosPolicies());
				expect(result.current.esAdmin()).toBe(true);
			}
		});

		it('should return false when policy has admin but unrelated module', () => {
			mockUserWithPolicies(['admin_facturas', 'admin_comisiones']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.esAdmin()).toBe(false);
		});

		it('should return false when policy matches module but lacks admin', () => {
			mockUserWithPolicies(['time_log_user', 'horarios_consulta']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.esAdmin()).toBe(false);
		});
	});

	describe('esAreaManager', () => {
		it('should return true when policy combines time_log and manager or area', () => {
			const validPolicies = [
				['time_log_manager'],
				['timelog_area'],
				['TIME-LOG_MANAGER'],
				['timelog_area_supervisor'],
			];

			for (const policies of validPolicies) {
				mockUserWithPolicies(policies);
				const { result } = renderHook(() => useHorariosPolicies());
				expect(result.current.esAreaManager()).toBe(true);
			}
		});

		it('should return false when policy has manager/area but lacks timelog prefix', () => {
			mockUserWithPolicies(['area_manager', 'general_manager']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.esAreaManager()).toBe(false);
		});
	});

	describe('esReport', () => {
		it('should return true when policy includes report', () => {
			mockUserWithPolicies(['time_log_report']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.esReport()).toBe(true);
		});

		it('should return true when esAreaManager is true even without explicit report policy', () => {
			mockUserWithPolicies(['time_log_manager']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.esAreaManager()).toBe(true);
			expect(result.current.esReport()).toBe(true);
		});

		it('should return false when user has neither report nor areaManager policy', () => {
			mockUserWithPolicies(['time_log_user']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.esReport()).toBe(false);
		});
	});

	describe('esComercial', () => {
		it('exige "comercial" y el módulo (time_log/horario)', () => {
			mockUserWithPolicies(['time_log_comercial']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.esComercial()).toBe(true);
		});

		it('ignora políticas "comercial" de otros módulos', () => {
			mockUserWithPolicies(['comercial_comisiones']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.esComercial()).toBe(false);
		});
	});

	describe('esNomina', () => {
		it('exige "nomina" y el módulo (time_log/horario)', () => {
			mockUserWithPolicies(['time_log_nomina']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.esNomina()).toBe(true);
			expect(result.current.esComercial()).toBe(false);
		});

		it('ignora políticas "nomina" de otros módulos', () => {
			mockUserWithPolicies(['nomina_rrhh']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.esNomina()).toBe(false);
		});
	});

	describe('esGerencia', () => {
		it('exige "gerencia" y el módulo, sin dar otros roles', () => {
			mockUserWithPolicies(['time_log_gerencia']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.esGerencia()).toBe(true);
			// Ni report (Asistencia) ni jefe de zona.
			expect(result.current.esReport()).toBe(false);
			expect(result.current.esAreaManager()).toBe(false);
			expect(result.current.esComercial()).toBe(false);
		});

		it('ignora políticas "gerencia" de otros módulos', () => {
			mockUserWithPolicies(['gerencia_comisiones']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.esGerencia()).toBe(false);
		});
	});

	describe('tieneTemporal', () => {
		it('should return true when policy is strictly temporal', () => {
			mockUserWithPolicies(['temporal']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.tieneTemporal()).toBe(true);

			mockUserWithPolicies(['TEMPORAL']);
			const { result: resultCaps } = renderHook(() => useHorariosPolicies());
			expect(resultCaps.current.tieneTemporal()).toBe(true);
		});

		it('should return false when policy is not strictly temporal', () => {
			mockUserWithPolicies(['temporal_override', 'temporada']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.tieneTemporal()).toBe(false);
		});
	});

	describe('puedeVerDemo', () => {
		it('should return true when policy contains demo', () => {
			mockUserWithPolicies(['demo']);
			const { result } = renderHook(() => useHorariosPolicies());
			expect(result.current.puedeVerDemo()).toBe(true);

			mockUserWithPolicies(['horarios_demo_tester']);
			const { result: resultSuffix } = renderHook(() => useHorariosPolicies());
			expect(resultSuffix.current.puedeVerDemo()).toBe(true);
		});

		it('should return false when policy lacks demo', () => {
			mockUserWithPolicies(['regular_user']);
			const { result } = renderHook(() => useHorariosPolicies());

			expect(result.current.puedeVerDemo()).toBe(false);
		});
	});
});
