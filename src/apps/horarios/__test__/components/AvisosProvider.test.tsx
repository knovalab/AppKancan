import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AvisosProvider } from '../../components/avisos/AvisosProvider';
import { useAvisos } from '../../hooks/useAvisos';
import type { AvisosValue } from '../../interfaces/avisos';

function montar() {
	const ref: { current: AvisosValue | null } = { current: null };
	const Consumidor = () => {
		ref.current = useAvisos();
		return null;
	};
	render(
		<AvisosProvider>
			<Consumidor />
		</AvisosProvider>,
	);
	return (...args: Parameters<AvisosValue['showSnackbar']>) =>
		act(() => ref.current?.showSnackbar(...args));
}

describe('AvisosProvider', () => {
	it('muestra el mensaje con su tipo: éxito como status, error como alert', async () => {
		const mostrar = montar();
		mostrar('Hora registrada correctamente', 'success');
		expect(await screen.findByRole('status')).toHaveTextContent(
			'Hora registrada correctamente',
		);
	});

	it('el texto largo se muestra completo', async () => {
		const mostrar = montar();
		const largo =
			'You don\'t have permission to access collection "com_period" or it does not exist.';
		mostrar(largo, 'error');
		expect(await screen.findByRole('alert')).toHaveTextContent(largo);
	});

	it('varios avisos seguidos: se muestran uno tras otro, sin atascarse', async () => {
		const user = userEvent.setup();
		const mostrar = montar();
		mostrar('uno', 'info');
		mostrar('dos', 'warning');
		mostrar('tres', 'success');

		for (const texto of ['uno', 'dos', 'tres']) {
			const aviso = await screen.findByText(texto);
			if (texto !== 'tres') {
				// Con otros en cola, el actual se cierra solo para dar paso al siguiente.
				await waitFor(() => expect(aviso).not.toBeInTheDocument());
			} else {
				await user.click(screen.getByRole('button', { name: /close/i }));
				await waitFor(() => expect(aviso).not.toBeInTheDocument());
			}
		}
	});

	it('muestra el detalle debajo del mensaje', async () => {
		const mostrar = montar();
		mostrar('Empleado creado', 'success', <span>Tarjeta del empleado</span>);
		expect(await screen.findByText('Tarjeta del empleado')).toBeInTheDocument();
	});

	it('fuera del proveedor, useAvisos avisa del error', () => {
		const Suelto = () => {
			useAvisos();
			return null;
		};
		expect(() => render(<Suelto />)).toThrow(/AvisosProvider/);
	});
});
