import React, { useEffect, useState } from 'react';
import {
	getCurrentUser,
	loginDirectus,
	logoutDirectus,
	refreshDirectus,
	setTokenDirectus,
} from '@/services/directus/auth';
import queryClient from '@/services/tankstack/QueryClient';
import { useNavigationPersistence } from '@/shared/hooks/useNavigationPersistence';
import {
	borrarTokenStorage,
	cargarTokenStorage,
	guardarTokenStorage,
	isExpired,
} from '../services/tokenDirectus';
import { AuthContext, type User } from './AuthContext';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [user, setUser] = useState<User>(null);
	const [loading, setLoading] = useState(true);
	const [initialized, setInitialized] = useState(false);

	const extractPolicies = (userData: any): string[] => {
		// Extraer políticas directas del usuario
		const directPolicies =
			userData?.policies?.map((p: any) => p.policy.name) || [];

		// Extraer políticas del rol
		const rolePolicies =
			userData?.role?.policies?.map((p: any) => p.policy.name) || [];

		// Combinar ambas listas
		const combined = [...directPolicies, ...rolePolicies];

		return combined;
	};

	const login = async (email: string, password: string) => {
		try {
			const res = await loginDirectus(email, password);
			guardarTokenStorage(res.access_token, res.refresh_token, res.expires_at);
			await setTokenDirectus(res.access_token);

			const me = await getCurrentUser();

			const extractedPolicies = extractPolicies(me);

			setUser({
				email: me.email,
				id: me.id,
				nombre: me.first_name,
				apellido: me.last_name,
				ultra_code: me.ultra_code,
				company: me.company,
				rol: me.role?.name,
				store_id: me.store_id?.id ?? me.store_id,
				store_name: me.store_id?.name,
				policies: extractedPolicies,
				requires_password_change: me.requires_password_change || false,
				ia_key: me.ia_key,
				models_ia: me.models_ia,
			});
		} catch (error) {
			console.error('❌ Error en login:', error);
			throw error;
		}
	};

	// Usar el hook de navegación para manejar la persistencia de la ruta
	const { clearSavedRoute, goToHome } = useNavigationPersistence();

	const logout = async () => {
		const tokens = cargarTokenStorage();

		if (tokens?.refresh) {
			try {
				await logoutDirectus(tokens.refresh);
			} catch (err) {
				console.warn('⚠️ No se pudo hacer logout en servidor:', err);
			}
		}

		// Limpiar caché de React Query al cerrar sesión para evitar fugas de información o datos obsoletos de otro usuario
		queryClient.clear();

		// Limpiar navegación persistente al hacer logout
		clearSavedRoute();

		// Limpiar cualquier otra referencia a la ruta en el sessionStorage
		sessionStorage.removeItem('lastVisitedRoute');

		// Limpiar cualquier otra referencia a la ruta en el localStorage
		localStorage.removeItem('lastVisitedRoute');

		// Redirigir al usuario al home para evitar que se quede en la última ruta
		goToHome();

		borrarTokenStorage();
		setUser(null);
		await setTokenDirectus(null);
	};

	useEffect(() => {
		const init = async () => {
			// Solo inicializar una vez
			if (initialized) return;
			setInitialized(true);

			const tokens = cargarTokenStorage();

			if (!tokens) {
				setLoading(false);
				return;
			}

			try {
				if (isExpired(tokens.expires_at)) {
					try {
						const res = await refreshDirectus(tokens.refresh);
						if (!res) {
							throw new Error('No se pudieron refrescar los tokens');
						}

						guardarTokenStorage(
							res.access_token,
							res.refresh_token,
							res.expires_at,
						);

						await setTokenDirectus(res.access_token);
					} catch (refreshError: any) {
						console.error('❌ Error al refrescar tokens:', refreshError);
						// Solo limpiar tokens si es un error de autenticación, no de red
						if (refreshError?.response?.status === 401) {
							borrarTokenStorage();
							setUser(null);
							await setTokenDirectus(null);
						}
						setLoading(false);
						return;
					}
				} else {
					await setTokenDirectus(tokens.access);
				}

				const me = await getCurrentUser();

				const extractedPolicies = extractPolicies(me);

				setUser({
					email: me.email,
					id: me.id,
					nombre: me.first_name,
					apellido: me.last_name,
					ultra_code: me.ultra_code,
					company: me.company,
					rol: me.role?.name,
					store_id: me.store_id?.id ?? me.store_id,
					store_name: me.store_id?.name,
					policies: extractedPolicies,
					requires_password_change: me.requires_password_change || false,
					ia_key: me.ia_key,
					models_ia: me.models_ia,
				});
			} catch (error: any) {
				console.error('❌ Error al inicializar autenticación:', error);
				// Solo limpiar tokens si es un error de autenticación específico
				if (
					error?.response?.status === 401 ||
					error?.message?.includes('Invalid token')
				) {
					borrarTokenStorage();
					setUser(null);
					await setTokenDirectus(null);
				}
				// Para otros errores (red, servidor), mantener el estado actual
			} finally {
				setLoading(false);
			}
		};

		init();
	}, [initialized]);

	const isAuthenticated = !!user;

	return (
		<AuthContext.Provider
			value={{ user, loading, isAuthenticated, login, logout }}
		>
			{children}
		</AuthContext.Provider>
	);
};
