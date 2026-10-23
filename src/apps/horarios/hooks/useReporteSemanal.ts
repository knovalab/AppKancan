import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import {
	getEmpleadosBulk,
	getPrimerPeriodoRegistro,
	getTimeRecordsBulkRange,
} from '../api/directus/read';
import type { EmpleadoAsistencia } from '../domain/registro/modelo';
import type { Tienda } from '../interfaces/tiendas';
import { getSemanasDelMes, NOMBRES_MESES } from '../pages/reporte/ReporteUtils';

export interface UseReporteSemanalProps {
	storeSel: number | null;
	tiendasAMostrar: Tienda[];
	tiendasPermitidas?: Tienda[];
	searchNombre?: string;
	enabled?: boolean;
	initialDiaInicioSemana?: number;
	initialDiaFinSemana?: number;
}

const ROWS_PER_PAGE_SEMANAL = 10;

export function useReporteSemanal({
	storeSel,
	tiendasAMostrar,
	tiendasPermitidas,
	searchNombre = '',
	enabled = true,
	initialDiaInicioSemana = 1,
	initialDiaFinSemana = 0,
}: UseReporteSemanalProps) {
	const [selectedYear, setSelectedYear] = useState(dayjs().year());
	const [selectedMonth, setSelectedMonth] = useState(dayjs().month()); // 0-indexed
	const [diaInicioSemana, setDiaInicioSemana] = useState<number>(
		initialDiaInicioSemana,
	);
	const [diaFinSemana, setDiaFinSemana] = useState<number>(initialDiaFinSemana);
	const [pageSemanal, setPageSemanal] = useState(0);
	const [reporteSemanalModo, setReporteSemanalModo] = useState<
		'tienda' | 'empleado'
	>('tienda');
	const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<number | null>(
		null,
	);

	const semanasDelMes = useMemo(() => {
		return getSemanasDelMes(
			selectedYear,
			selectedMonth,
			diaInicioSemana,
			diaFinSemana,
		);
	}, [selectedYear, selectedMonth, diaInicioSemana, diaFinSemana]);

	const startRange = semanasDelMes[0]?.start;
	const endRange = semanasDelMes[semanasDelMes.length - 1]?.end;

	const allStoreIds = useMemo(
		() => tiendasAMostrar.map((t) => Number(t.id)),
		[tiendasAMostrar],
	);

	const targetStores = useMemo(() => {
		if (storeSel !== null) return [storeSel];
		return allStoreIds;
	}, [storeSel, allStoreIds]);

	// Fetch time records for the target stores within month range
	const { data: recordsMensuales = [], isLoading: cargandoRecords } = useQuery({
		queryKey: ['recordsMensuales', targetStores, startRange, endRange],
		queryFn: () => {
			if (targetStores.length === 0 || !startRange || !endRange)
				return Promise.resolve([]);
			return getTimeRecordsBulkRange(targetStores, startRange, endRange);
		},
		enabled:
			enabled &&
			reporteSemanalModo === 'tienda' &&
			targetStores.length > 0 &&
			Boolean(startRange) &&
			Boolean(endRange),
		staleTime: 5 * 60 * 1000,
	});

	// Fetch employees of the selected store(s)
	const { data: empleadosStore = [], isLoading: cargandoEmpleados } = useQuery({
		queryKey: ['empleadosStore', targetStores],
		queryFn: () => {
			if (targetStores.length === 0) return Promise.resolve([]);
			return getEmpleadosBulk(targetStores);
		},
		enabled:
			enabled && reporteSemanalModo === 'tienda' && targetStores.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	// Fetch all employees for employee autocomplete
	const { data: todosEmpleados = [], isLoading: cargandoTodosEmpleados } =
		useQuery({
			queryKey: [
				'todosEmpleadosAutocomplete',
				tiendasPermitidas ? allStoreIds : [],
			],
			queryFn: () => getEmpleadosBulk(tiendasPermitidas ? allStoreIds : []),
			enabled,
			staleTime: 30 * 60 * 1000,
		});

	// Fetch global records when in 'empleado' mode
	const {
		data: recordsMensualesGlobal = [],
		isLoading: cargandoRecordsGlobal,
	} = useQuery({
		queryKey: ['recordsMensualesGlobal', allStoreIds, startRange, endRange],
		queryFn: () => {
			if (allStoreIds.length === 0 || !startRange || !endRange)
				return Promise.resolve([]);
			return getTimeRecordsBulkRange(allStoreIds, startRange, endRange);
		},
		enabled:
			enabled &&
			reporteSemanalModo === 'empleado' &&
			allStoreIds.length > 0 &&
			Boolean(startRange) &&
			Boolean(endRange),
		staleTime: 5 * 60 * 1000,
	});

	const recordsSelectedEmp = useMemo(() => {
		if (!selectedEmpleadoId) return [];
		return recordsMensualesGlobal.filter(
			(r) =>
				Number(r.employee_id?.id || r.employee_id) ===
				Number(selectedEmpleadoId),
		);
	}, [recordsMensualesGlobal, selectedEmpleadoId]);

	const storesTrabajadas = useMemo(() => {
		if (recordsSelectedEmp.length === 0) return [];
		const storesMap = new Map<number, string>(
			tiendasAMostrar.map((t) => [Number(t.id), t.name]),
		);
		const uniqueIds = Array.from(
			new Set(recordsSelectedEmp.map((r) => Number(r.store_id))),
		);
		return uniqueIds.map((id) => ({
			id,
			name: storesMap.get(id) || `Tienda #${id}`,
		}));
	}, [recordsSelectedEmp, tiendasAMostrar]);

	const empleadosFiltradosSemanales = useMemo(() => {
		return empleadosStore.filter((emp: EmpleadoAsistencia) => {
			const fullName = emp.nombre || '';
			return fullName.toLowerCase().includes(searchNombre.toLowerCase());
		});
	}, [empleadosStore, searchNombre]);

	const paginatedEmpleadosSemanal = useMemo(() => {
		const start = pageSemanal * ROWS_PER_PAGE_SEMANAL;
		return empleadosFiltradosSemanales.slice(
			start,
			start + ROWS_PER_PAGE_SEMANAL,
		);
	}, [empleadosFiltradosSemanales, pageSemanal]);

	const totalPagesSemanal = Math.max(
		1,
		Math.ceil(empleadosFiltradosSemanales.length / ROWS_PER_PAGE_SEMANAL),
	);

	const { data: primerPeriodo = { year: dayjs().year(), month: 0 } } = useQuery(
		{
			queryKey: ['primerPeriodoRegistro'],
			queryFn: getPrimerPeriodoRegistro,
			staleTime: Number.POSITIVE_INFINITY,
		},
	);

	const listadoAnios = useMemo(() => {
		const currentYear = dayjs().year();
		const years = [];
		const startY = primerPeriodo.year;
		for (let y = startY; y <= currentYear; y++) {
			years.push(y);
		}
		if (years.length === 0) {
			years.push(currentYear);
		}
		return years;
	}, [primerPeriodo.year]);

	const listadoMeses = useMemo(() => {
		const startM =
			selectedYear === primerPeriodo.year ? primerPeriodo.month : 0;
		const endM = selectedYear === dayjs().year() ? dayjs().month() : 11;
		const months = [];
		for (let m = startM; m <= endM; m++) {
			months.push({ value: m, label: NOMBRES_MESES[m] });
		}
		return months;
	}, [selectedYear, primerPeriodo]);

	useEffect(() => {
		const minM = selectedYear === primerPeriodo.year ? primerPeriodo.month : 0;
		const maxM = selectedYear === dayjs().year() ? dayjs().month() : 11;
		if (selectedMonth < minM) {
			setSelectedMonth(minM);
		} else if (selectedMonth > maxM) {
			setSelectedMonth(maxM);
		}
	}, [selectedYear, primerPeriodo, selectedMonth]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset page when filters change
	useEffect(() => {
		setPageSemanal(0);
	}, [selectedMonth, selectedYear, targetStores, searchNombre]);

	return {
		reporteSemanalModo,
		setReporteSemanalModo,
		storeSel,
		selectedMonth,
		setSelectedMonth,
		selectedYear,
		setSelectedYear,
		listadoMeses,
		listadoAnios,
		cargandoRecords,
		cargandoEmpleados,
		semanasDelMes,
		paginatedEmpleadosSemanal,
		empleadosFiltradosSemanales,
		recordsMensuales,
		pageSemanal,
		setPageSemanal,
		totalPagesSemanal,
		todosEmpleados,
		selectedEmpleadoId,
		setSelectedEmpleadoId,
		recordsSelectedEmp,
		cargandoTodosEmpleados,
		cargandoRecordsGlobal,
		storesTrabajadas,
		diaInicioSemana,
		setDiaInicioSemana,
		diaFinSemana,
		setDiaFinSemana,
		tiendas: tiendasAMostrar,
	};
}
