import { yupResolver } from '@hookform/resolvers/yup';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import { ThemeProvider } from '@mui/material/styles';
import { Controller, useForm } from 'react-hook-form';
import LogoBlack from '@/assets/Logo_letras.png';
import InputWithIcon from '@/auth/components/inputs';
import CustomSnackbar from '@/auth/components/SnackbarAlert';
import { useAuth } from '@/auth/hooks/useAuth';
import { useSnackbar } from '@/auth/hooks/useSnackbar';
import { loginTheme } from '@/shared/hooks/loginTheme';
import { useAppTheme } from '@/shared/hooks/ThemeContext';
import { loginSchema as schema } from '@/shared/utils/loginSchema';

function Login() {
	const { login } = useAuth();
	const { darkMode, toggleTheme } = useAppTheme();
	const { snackbar, showSnackbar, closeSnackbar } = useSnackbar();
	const {
		control,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm({
		resolver: yupResolver(schema),
	});

	const onSubmit = async (data: { email: string; password: string }) => {
		try {
			await login(data.email, data.password);
		} catch (error: any) {
			let message: string = 'Error al iniciar sesión. Inténtalo de nuevo.';

			if (error?.response?.status === 401) {
				message = 'Credenciales incorrectas.';
			} else if (
				error?.response?.data?.errors?.[0]?.message === 'User suspended'
			) {
				message = 'Tu cuenta está suspendida. Contacta al administrador.';
				reset();
			} else if (error?.message?.includes('Network Error')) {
				message = 'No se pudo conectar con el servidor.';
			} else {
				message = 'Error interno del servidor. Inténtalo más tarde.';
			}

			showSnackbar(message, 'error');
		}
	};

	return (
		<ThemeProvider theme={loginTheme}>
			<div className="min-h-screen flex items-center justify-center bg-cover bg-center px-4 sm:px-6">
				<div className="absolute top-4 right-4">
					<IconButton
						onClick={() => toggleTheme(!darkMode)}
						sx={{
							transition: 'transform 0.3s ease-in-out',
							transform: darkMode ? 'rotate(180deg)' : 'rotate(0deg)',
							'& .MuiSvgIcon-root': {
								transition: 'color 0.3s ease-in-out',
							},
						}}
					>
						{darkMode ? (
							<LightModeIcon
								sx={{ color: darkMode ? '#f5d742' : '#004680', fontSize: 28 }}
							/>
						) : (
							<DarkModeIcon
								sx={{ color: darkMode ? '#f5d742' : '#004680', fontSize: 28 }}
							/>
						)}
					</IconButton>
				</div>
				<div className="bg-white rounded-2xl border border-gray-200 shadow-lg w-full max-w-sm sm:max-w-md lg:max-w-lg p-6 sm:p-8 mx-2 sm:mx-0 relative">
					<h2 className="m-6 text-center">
						<img
							src={LogoBlack}
							alt="logo"
							style={{
								width: '360px',
								height: 'auto',
								objectFit: 'contain',
								margin: '0 auto',
							}}
						/>
					</h2>

					<form
						onSubmit={handleSubmit(onSubmit)}
						className="flex flex-col items-center justify-center gap-6 w-full"
					>
						<div className="w-full flex flex-col gap-6">
							<Controller
								name="email"
								control={control}
								defaultValue=""
								render={({ field }) => (
									<InputWithIcon
										id="email"
										label="Correo"
										type="email"
										value={field.value}
										onChange={field.onChange}
										Icon={MailOutlineIcon}
										variant="standard"
										placeholder="correo@ejemplo.com"
										autoComplete="username"
										error={!!errors.email}
										helperText={errors.email?.message}
									/>
								)}
							/>

							<Controller
								name="password"
								control={control}
								defaultValue=""
								render={({ field }) => (
									<InputWithIcon
										id="password"
										label="Contraseña"
										type="password"
										value={field.value}
										onChange={field.onChange}
										Icon={LockOutlinedIcon}
										variant="standard"
										placeholder="*****"
										autoComplete="current-password"
										error={!!errors.password}
										helperText={errors.password?.message}
									/>
								)}
							/>
						</div>

						<div className="flex justify-center w-1/3">
							<Button
								type="submit"
								fullWidth
								size="large"
								disabled={isSubmitting}
								sx={{
									backgroundColor: '#004680',
									color: '#FFF',
									'&:hover': {
										backgroundColor: '#002747',
									},
								}}
							>
								{isSubmitting ? (
									<CircularProgress size={24} sx={{ color: '#FFF' }} />
								) : (
									'Ingresar'
								)}
							</Button>
						</div>
					</form>
				</div>

				<CustomSnackbar
					open={snackbar.open}
					message={snackbar.message}
					severity={snackbar.severity}
					onClose={closeSnackbar}
				/>
			</div>
		</ThemeProvider>
	);
}

export default Login;
