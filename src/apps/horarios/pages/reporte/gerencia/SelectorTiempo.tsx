import {
	Box,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	ToggleButton,
	ToggleButtonGroup,
} from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import DateRangeFilter from '../../../components/reportes/DateRangeFilter';
import { periodoActual } from '../../../domain/horasExtras';
import { usePeriodosGerencia } from '../../../hooks/useReporteGerencia';
import { getRealColombiaTime } from '../../../utils/timeSync';
import { NOMBRES_MESES } from '../ReporteUtils';
import { TACTIL } from './bloques';

export type ModoTiempo = 'periodo' | 'mes' | 'rango';

const ETIQUETA_MODO: Record<ModoTiempo, string> = {
	periodo: 'Periodo',
	mes: 'Mes',
	rango: 'Rango',
};
/** Meses que ofrece el selector, contando el actual. */
const MESES_ATRAS = 24;
const corta = (f: string) => dayjs(f).format('DD/MM');
const nombrePeriodo = (p: { name?: string | null }) => p.name || 'Sin nombre';
const control = {
	minWidth: { sm: 220 },
	width: { sm: 'auto' },
	'& .MuiInputBase-root': { minHeight: TACTIL },
};

/** `YYYY-MM` → "Octubre 2026". */
export const nombreMes = (mes: string) =>
	`${NOMBRES_MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

/** Fechas de un mes `YYYY-MM`; el mes en curso termina hoy. */
export function rangoDeMes(mes: string, hoy: Dayjs) {
	const inicio = dayjs(`${mes}-01`);
	const fin = inicio.endOf('month');
	return {
		desde: inicio.format('YYYY-MM-DD'),
		hasta: (fin.isAfter(hoy, 'day') ? hoy : fin).format('YYYY-MM-DD'),
	};
}

/**
 * Tiempo de un reporte de gerencia: un periodo de nómina, un mes calendario o un
 * rango libre (solo los `modos` pedidos). `listo` es falso mientras no haya
 * periodo, para no consultar toda la historia.
 */
export function useSelectorTiempo(
	modos: readonly ModoTiempo[],
	inicial: ModoTiempo = modos[0],
) {
	const hoy = getRealColombiaTime();
	const [modo, setModo] = useState(inicial);
	const [periodoId, setPeriodoId] = useState<number | ''>('');
	const [mes, setMes] = useState(() => hoy.format('YYYY-MM'));
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(() =>
		hoy.startOf('month'),
	);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(() => hoy);

	const periodosQ = usePeriodosGerencia();
	const periodos = periodosQ.data ?? [];
	const periodo =
		periodos.find((p) => p.id === periodoId) ??
		periodoActual(periodos, hoy.format('YYYY-MM-DD'));
	const meses = Array.from({ length: MESES_ATRAS }, (_, i) =>
		hoy.subtract(i, 'month').format('YYYY-MM'),
	);

	let desde = '';
	let hasta = '';
	let etiqueta = 'Sin periodo';
	if (modo === 'periodo' && periodo) {
		desde = periodo.start_date;
		hasta = periodo.end_date;
		etiqueta = `${nombrePeriodo(periodo)} (${corta(desde)} al ${corta(hasta)})`;
	} else if (modo === 'mes') {
		({ desde, hasta } = rangoDeMes(mes, hoy));
		etiqueta = nombreMes(mes);
	} else if (modo === 'rango') {
		// Sin rango ("Todo"): desde el inicio del año, para no pedir la historia entera.
		desde = (fechaInicio ?? hoy.startOf('year')).format('YYYY-MM-DD');
		hasta = (fechaFin ?? hoy).format('YYYY-MM-DD');
		etiqueta = `${corta(desde)} al ${corta(hasta)}`;
	}
	const porPeriodo = modo === 'periodo';

	return {
		modos,
		modo,
		setModo,
		desde,
		hasta,
		etiqueta,
		listo: desde !== '',
		cargando: porPeriodo && periodosQ.isLoading,
		sinPeriodos: porPeriodo && periodosQ.isSuccess && periodos.length === 0,
		error: porPeriodo ? periodosQ.error : null,
		periodos,
		periodo,
		setPeriodoId,
		meses,
		mes,
		setMes,
		fechaInicio,
		fechaFin,
		setRango: (inicio: Dayjs | null, fin: Dayjs | null) => {
			setFechaInicio(inicio);
			setFechaFin(fin);
		},
	};
}

/** Modo (Periodo | Mes | Rango) y el control del modo elegido; va dentro de `Filtros`. */
export function SelectorTiempo({
	selector: s,
	onCambio,
}: {
	selector: ReturnType<typeof useSelectorTiempo>;
	onCambio?: () => void;
}) {
	return (
		<>
			{s.modos.length > 1 && (
				<ToggleButtonGroup
					exclusive
					size="small"
					value={s.modo}
					onChange={(_, m: ModoTiempo | null) => {
						if (!m) return;
						s.setModo(m);
						onCambio?.();
					}}
					aria-label="Ver por"
					sx={{ '& .MuiToggleButton-root': { minHeight: TACTIL, px: 2 } }}
				>
					{s.modos.map((m) => (
						<ToggleButton key={m} value={m}>
							{ETIQUETA_MODO[m]}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			)}
			{s.modo === 'periodo' && (
				<FormControl size="small" fullWidth sx={control}>
					<InputLabel id="st-periodo">Periodo</InputLabel>
					<Select
						labelId="st-periodo"
						label="Periodo"
						value={s.periodo?.id ?? ''}
						onChange={(e) => {
							s.setPeriodoId(Number(e.target.value) || '');
							onCambio?.();
						}}
					>
						{s.periodos.map((p) => (
							<MenuItem key={p.id} value={p.id}>
								{nombrePeriodo(p)} ({corta(p.start_date)} al {corta(p.end_date)}
								)
							</MenuItem>
						))}
					</Select>
				</FormControl>
			)}
			{s.modo === 'mes' && (
				<FormControl size="small" fullWidth sx={control}>
					<InputLabel id="st-mes">Mes</InputLabel>
					<Select
						labelId="st-mes"
						label="Mes"
						value={s.mes}
						onChange={(e) => {
							s.setMes(e.target.value);
							onCambio?.();
						}}
					>
						{s.meses.map((m) => (
							<MenuItem key={m} value={m}>
								{nombreMes(m)}
							</MenuItem>
						))}
					</Select>
				</FormControl>
			)}
			{s.modo === 'rango' && (
				<Box sx={{ width: { xs: '100%', sm: 280 } }}>
					<DateRangeFilter
						fechaInicio={s.fechaInicio}
						fechaFin={s.fechaFin}
						onChange={(inicio, fin) => {
							s.setRango(inicio, fin);
							onCambio?.();
						}}
					/>
				</Box>
			)}
		</>
	);
}
