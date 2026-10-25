import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BarraAccionesTarjetas } from '../../../components/registro/BarraAccionesTarjetas';

describe('BarraAccionesTarjetas', () => {
	const defaultProps = {
		totalEmpleados: 4,
		totalExpandidas: 2,
		totalColapsadas: 2,
		todasExpandidas: false,
		todasColapsadas: false,
		conteos: {
			activas: 2,
			pendientes: 1,
			finalizadas: 1,
		},
		onExpandirTodas: vi.fn(),
		onContraerTodas: vi.fn(),
		onExpandirPorEstado: vi.fn(),
	};

	it('no renderiza nada si totalEmpleados es 0', () => {
		const { container } = render(
			<BarraAccionesTarjetas {...defaultProps} totalEmpleados={0} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it('renderiza botones de acción masiva y chips de filtros con conteos', () => {
		render(<BarraAccionesTarjetas {...defaultProps} />);

		expect(
			screen.getByRole('button', { name: /contraer todas/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /expandir todas/i }),
		).toBeInTheDocument();
		expect(screen.getByText('En turno: 2')).toBeInTheDocument();
		expect(screen.getByText('Pendientes: 1')).toBeInTheDocument();
		expect(screen.getByText('Finalizados: 1')).toBeInTheDocument();
		expect(screen.getByText('2 de 4 expandidas')).toBeInTheDocument();
	});

	it('en modo compacto (tienda) mantiene los botones accesibles por nombre', () => {
		const onExpandirTodas = vi.fn();
		render(
			<BarraAccionesTarjetas
				{...defaultProps}
				compacta
				onExpandirTodas={onExpandirTodas}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Expandir todas' }));
		expect(onExpandirTodas).toHaveBeenCalledTimes(1);
		expect(
			screen.getByRole('button', { name: 'Contraer todas' }),
		).toBeInTheDocument();
	});

	it('llama a onContraerTodas al pulsar el botón Contraer todas', () => {
		const onContraerTodas = vi.fn();
		render(
			<BarraAccionesTarjetas
				{...defaultProps}
				onContraerTodas={onContraerTodas}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /contraer todas/i }));
		expect(onContraerTodas).toHaveBeenCalledTimes(1);
	});

	it('llama a onExpandirTodas al pulsar el botón Expandir todas', () => {
		const onExpandirTodas = vi.fn();
		render(
			<BarraAccionesTarjetas
				{...defaultProps}
				onExpandirTodas={onExpandirTodas}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /expandir todas/i }));
		expect(onExpandirTodas).toHaveBeenCalledTimes(1);
	});

	it('deshabilita el botón Contraer todas cuando todas están colapsadas', () => {
		render(
			<BarraAccionesTarjetas
				{...defaultProps}
				todasColapsadas={true}
				totalExpandidas={0}
				totalColapsadas={4}
			/>,
		);

		expect(
			screen.getByRole('button', { name: /contraer todas/i }),
		).toBeDisabled();
		expect(
			screen.getByRole('button', { name: /expandir todas/i }),
		).toBeEnabled();
		expect(screen.getByText('Todas contraídas (4)')).toBeInTheDocument();
	});

	it('deshabilita el botón Expandir todas cuando todas están expandidas', () => {
		render(
			<BarraAccionesTarjetas
				{...defaultProps}
				todasExpandidas={true}
				totalExpandidas={4}
				totalColapsadas={0}
			/>,
		);

		expect(
			screen.getByRole('button', { name: /expandir todas/i }),
		).toBeDisabled();
		expect(
			screen.getByRole('button', { name: /contraer todas/i }),
		).toBeEnabled();
		expect(screen.getByText('Todas expandidas (4)')).toBeInTheDocument();
	});

	it('llama a onExpandirPorEstado con el filtro correspondiente al pulsar los chips', () => {
		const onExpandirPorEstado = vi.fn();
		render(
			<BarraAccionesTarjetas
				{...defaultProps}
				onExpandirPorEstado={onExpandirPorEstado}
			/>,
		);

		fireEvent.click(screen.getByText('En turno: 2'));
		expect(onExpandirPorEstado).toHaveBeenCalledWith('activas');

		fireEvent.click(screen.getByText('Pendientes: 1'));
		expect(onExpandirPorEstado).toHaveBeenCalledWith('pendientes');

		fireEvent.click(screen.getByText('Finalizados: 1'));
		expect(onExpandirPorEstado).toHaveBeenCalledWith('finalizadas');
	});
});

describe('BarraAccionesTarjetas · teléfono en vista tienda', () => {
	const original = window.matchMedia;
	beforeEach(() => {
		// Todas las consultas `down(...)` coinciden: ancho de teléfono.
		window.matchMedia = vi.fn().mockImplementation((media: string) => ({
			matches: true,
			media,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: () => false,
		}));
	});
	afterEach(() => {
		window.matchMedia = original;
	});

	it('chips solo con el número, conservando el nombre accesible', () => {
		render(
			<BarraAccionesTarjetas
				totalEmpleados={4}
				totalExpandidas={2}
				totalColapsadas={2}
				todasExpandidas={false}
				todasColapsadas={false}
				conteos={{ activas: 2, pendientes: 1, finalizadas: 3 }}
				onExpandirTodas={vi.fn()}
				onContraerTodas={vi.fn()}
				onExpandirPorEstado={vi.fn()}
				compacta
			/>,
		);

		expect(screen.queryByText('En turno: 2')).not.toBeInTheDocument();
		expect(screen.getByLabelText('En turno: 2')).toHaveTextContent('2');
		expect(screen.getByLabelText('Finalizados: 3')).toHaveTextContent('3');
	});
});
