import { Coffee, LogOut, Play, UtensilsCrossed } from 'lucide-react';
import { LOG_TYPE } from '../../domain/registro';

export interface EventoMeta {
	orden: number;
	icon: typeof Play;
	color: string;
	bg: string;
	label: string;
}

export const EVENTO_META: Record<string, EventoMeta> = {
	[LOG_TYPE.inicioJornada]: {
		orden: 0,
		icon: Play,
		color: '#16a34a',
		bg: '#dcfce7',
		label: 'Inicio de Jornada',
	},
	[LOG_TYPE.inicioAlmuerzo]: {
		orden: 1,
		icon: Coffee,
		color: '#ea580c',
		bg: '#ffedd5',
		label: 'Inicio de Almuerzo',
	},
	[LOG_TYPE.finAlmuerzo]: {
		orden: 2,
		icon: UtensilsCrossed,
		color: '#ca8a04',
		bg: '#fef9c3',
		label: 'Fin de Almuerzo',
	},
	[LOG_TYPE.finJornada]: {
		orden: 3,
		icon: LogOut,
		color: '#004680',
		bg: '#eaf2fb',
		label: 'Fin de Jornada',
	},
};

export const getEventoMeta = (tipo: string): EventoMeta => {
	return (
		EVENTO_META[tipo] ?? {
			orden: 99,
			icon: Play,
			color: '#64748b',
			bg: '#f1f5f9',
			label: tipo,
		}
	);
};

export const getIniciales = (nombre: string): string => {
	const limpio = nombre.trim();
	if (!limpio) return '?';
	return limpio[0].toUpperCase();
};
