import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContadorPausa } from '@/apps/horarios/components/employee-card/slots/ContadorPausa';

describe('ContadorPausa', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should render remaining time formatted as mm:ss', () => {
		const now = 1000000;
		vi.setSystemTime(now);

		// 3 minutes and 45 seconds in future = 225,000 ms
		const expiraEn = now + 225000;

		render(<ContadorPausa expiraEn={expiraEn} />);

		expect(screen.getByText('Pausas Activas')).toBeInTheDocument();
		expect(screen.getByText('3:45')).toBeInTheDocument();
	});

	it('should countdown every second', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		const expiraEn = now + 65000; // 1:05

		render(<ContadorPausa expiraEn={expiraEn} />);

		expect(screen.getByText('1:05')).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(5000); // 5 seconds pass -> 1:00
		});

		expect(screen.getByText('1:00')).toBeInTheDocument();

		act(() => {
			vi.advanceTimersByTime(1000); // 1 second pass -> 0:59
		});

		expect(screen.getByText('0:59')).toBeInTheDocument();
	});

	it('should not go below 0:00 when expired', () => {
		const now = 1000000;
		vi.setSystemTime(now);
		const expiraEn = now + 2000;

		render(<ContadorPausa expiraEn={expiraEn} />);

		act(() => {
			vi.advanceTimersByTime(10000);
		});

		expect(screen.getByText('0:00')).toBeInTheDocument();
	});

	it('should render and handle "Terminar Demo" button when provided', () => {
		const mockTerminarDemo = vi.fn();
		const now = 1000000;
		vi.setSystemTime(now);
		const expiraEn = now + 60000;

		render(
			<ContadorPausa expiraEn={expiraEn} onTerminarDemo={mockTerminarDemo} />,
		);

		const demoBtn = screen.getByRole('button', { name: /Terminar Demo/i });
		expect(demoBtn).toBeInTheDocument();

		fireEvent.click(demoBtn);
		expect(mockTerminarDemo).toHaveBeenCalledTimes(1);
	});
});
