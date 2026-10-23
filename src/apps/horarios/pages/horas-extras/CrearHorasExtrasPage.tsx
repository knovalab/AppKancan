import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	LinearProgress,
	Paper,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { crearHorasExtras } from '../../api/directus/horasExtras';
import { getEmpleadosBulk } from '../../api/directus/readBulk';
import { idRelacion } from '../../api/directus/relacion';
import { ReporteTiendasPagination } from '../../components/com_time_record_store';
import {
	ConfirmarRegistroDialog,
	type PersonaResumen,
} from '../../components/horas-extras/ConfirmarRegistroDialog';
import { GrillaHorasExtras } from '../../components/horas-extras/GrillaHorasExtras';
import {
	BLOQUE_MINUTOS,
	buscarDuplicado,
	claveDia,
	diasDelRango,
	ETIQUETA_ESTADO_HORA_EXTRA,
	formatoMinutos,
	lineasDeCeldas,
	MAX_DIAS_GRILLA,
	MAX_LINEAS_LOTE,
	validarLineas,
	validarRangoGrilla,
} from '../../domain/horasExtras';
import { horariosKeys } from '../../hooks/registro/keys';
import { useAvisos } from '../../hooks/useAvisos';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import { useHorasExtras } from '../../hooks/useHorasExtras';
import type { OverTimeDto } from '../../interfaces/api/overTime';
import { mensajeDeError } from '../../utils/errores';
import { formatNombrePropio } from '../../utils/format';
import { coincideEmpleado } from '../../utils/horasExtras';
import { getRealColombiaTime } from '../../utils/timeSync';

/** Valores rápidos (minutos) para rellenar. */
const VALORES_RAPIDOS = [30, 60, 90, 120, 180];

const plural = (n: number, uno: string, varios: string) =>
	`${n} ${n === 1 ? uno : varios}`;

const REGISTRADAS = 'horas-extras/registradas';

/**
 * Sub‑página "Registrar horas extras" (/horarios/horas-extras/registradas/nueva)
 * del líder: grilla personas × días (máx. 5) de las tiendas del header, con
 * accesos rápidos para rellenar filas y columnas y observación por persona.
 * Se crea una hora extra por celda con valor, todas en una petición.
 */
export default function CrearHorasExtrasPage() {
	const { tienda, acceso, irA } = useHorariosLayout();
	const { user } = useAuth();
	const { showSnackbar } = useAvisos();
	const queryClient = useQueryClient();
	const hoy = getRealColombiaTime().format('YYYY-MM-DD');

	const [desde, setDesde] = useState(hoy);
	const [hasta, setHasta] = useState(hoy);
	const [busqueda, setBusqueda] = useState('');
	const [valor, setValor] = useState(60);
	const [seleccion, setSeleccion] = useState<ReadonlySet<string>>(new Set());
	const [celdas, setCeldas] = useState<ReadonlyMap<string, number>>(new Map());
	const [observaciones, setObservaciones] = useState<
		ReadonlyMap<string, string>
	>(new Map());
	const [confirmando, setConfirmando] = useState(false);
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(25);
	const [tiendaElegida, setTiendaElegida] = useState<
		ReadonlyMap<string, number>
	>(new Map());

	const storeIds = tienda.storeIds;
	// Sin tiendas no se consulta: getEmpleadosBulk sin filtro traería a todos.
	const { data: empleados = [], isLoading: cargandoEmpleados } = useQuery({
		queryKey: horariosKeys.empleados.tiendas(storeIds),
		queryFn: () => getEmpleadosBulk(storeIds),
		enabled: storeIds.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const errorRango = validarRangoGrilla(desde, hasta, hoy);
	const dias = useMemo(
		() => (errorRango ? [] : diasDelRango(desde, hasta)),
		[errorRango, desde, hasta],
	);

	const personas = useMemo(
		() =>
			empleados.map((e) => ({
				id: e.id,
				nombre: formatNombrePropio(e.nombre),
				documento: e.documento,
				cargo: e.cargo,
				storeId: e.storeId ?? null,
			})),
		[empleados],
	);
	const visibles = useMemo(() => {
		const q = busqueda.trim();
		return q
			? personas.filter((p) =>
					coincideEmpleado({ empleado: p.nombre, documento: p.documento }, q),
				)
			: personas;
	}, [personas, busqueda]);
	const tiendaDe = useMemo(() => {
		const m = new Map<string, number>();
		for (const p of personas) {
			const t = tiendaElegida.get(p.id) ?? p.storeId;
			if (t != null) m.set(p.id, t);
		}
		return m;
	}, [personas, tiendaElegida]);

	// Horas extras ya registradas en el rango (aviso por celda, no bloquea).
	// Las tiendas elegidas bastan: el filtro incluye la tienda del empleado aunque haya rotado.
	const { data: registradas = [], isFetching: comprobando } = useHorasExtras(
		{ tiendas: storeIds, desde, hasta, incluirPruebas: true },
		dias.length > 0,
	);
	const existentes = useMemo(() => {
		const porDia = new Map<string, OverTimeDto[]>();
		for (const h of registradas) {
			const id = idRelacion(h.employee_id);
			if (id == null) continue;
			const k = claveDia(id, h.work_date);
			porDia.set(k, [...(porDia.get(k) ?? []), h]);
		}
		const res = new Map<string, string>();
		for (const [k, delDia] of porDia) {
			const d = buscarDuplicado(delDia);
			if (d)
				res.set(
					k,
					`Ya: ${formatoMinutos(d.minutes)} ${ETIQUETA_ESTADO_HORA_EXTRA[d.status].toLowerCase()}`,
				);
		}
		return res;
	}, [registradas]);

	const lineas = useMemo(
		() =>
			lineasDeCeldas(
				celdas,
				dias,
				personas.map((p) => p.id),
			),
		[celdas, dias, personas],
	);
	const errores = useMemo(() => validarLineas(lineas, hoy), [lineas, hoy]);
	const conExistente = lineas.filter((l) => existentes.has(l.clave)).length;
	const totalMinutos = lineas.reduce((s, l) => s + l.minutos, 0);
	const personasConHoras = new Set(lineas.map((l) => l.empleadoId)).size;
	const excede = lineas.length > MAX_LINEAS_LOTE;

	// Callbacks estables: las filas de la grilla están memorizadas y solo se repintan si cambian.
	const poner = useCallback(
		(claves: string[], minutos: number) =>
			setCeldas((prev) => {
				const sig = new Map(prev);
				for (const k of claves) {
					if (minutos) sig.set(k, minutos);
					else sig.delete(k);
				}
				return sig;
			}),
		[],
	);
	const onCelda = useCallback(
		(clave: string, minutos: number) => poner([clave], minutos),
		[poner],
	);
	const onSeleccion = useCallback(
		(ids: string[], marcar: boolean) =>
			setSeleccion((prev) => {
				const sig = new Set(prev);
				for (const id of ids) {
					if (marcar) sig.add(id);
					else sig.delete(id);
				}
				return sig;
			}),
		[],
	);
	const onObservacion = useCallback(
		(id: string, texto: string) =>
			setObservaciones((prev) => new Map(prev).set(id, texto)),
		[],
	);
	const onTienda = useCallback(
		(id: string, t: number) =>
			setTiendaElegida((prev) => new Map(prev).set(id, t)),
		[],
	);
	const onRellenarFila = useCallback(
		(id: string) =>
			poner(
				dias.map((d) => claveDia(id, d)),
				valor,
			),
		[poner, dias, valor],
	);
	/** Columna: a las personas seleccionadas o, si no hay, a todas las filtradas (todas las páginas). */
	const onRellenarColumna = useCallback(
		(d: string) => {
			const marcadas = visibles.filter((p) => seleccion.has(p.id));
			poner(
				(marcadas.length > 0 ? marcadas : visibles).map((p) =>
					claveDia(p.id, d),
				),
				valor,
			);
		},
		[poner, visibles, seleccion, valor],
	);
	const tiendasGrilla = useMemo(
		() =>
			acceso.tiendasPermitidas.map((t) => ({
				id: Number(t.id),
				name: t.name,
			})),
		[acceso.tiendasPermitidas],
	);

	// Paginación de la grilla: montar cientos de filas con inputs es lo que más tarda.
	const totalPages = Math.max(1, Math.ceil(visibles.length / rowsPerPage));
	const actual = Math.min(page, totalPages - 1);
	const pagina = useMemo(
		() => visibles.slice(actual * rowsPerPage, (actual + 1) * rowsPerPage),
		[visibles, actual, rowsPerPage],
	);
	// Al cambiar de página/filtro, React pinta en segundo plano y mostramos la barra mientras tanto.
	const paginaDiferida = useDeferredValue(pagina);
	const pintando = paginaDiferida !== pagina;

	const guardar = useMutation({
		mutationFn: crearHorasExtras,
		onSuccess: (_, datos) => {
			void queryClient.invalidateQueries({
				queryKey: horariosKeys.horasExtras.todos,
			});
			showSnackbar(
				`${plural(datos.length, 'hora extra registrada', 'horas extras registradas')}: quedan pendientes de aprobación`,
				'success',
			);
			irA(REGISTRADAS);
		},
		onError: (err) =>
			showSnackbar(
				mensajeDeError(err, 'Error al registrar las horas extras'),
				'error',
			),
	});

	const registrar = () =>
		guardar.mutate(
			lineas.map((l) => ({
				employee_id: Number(l.empleadoId),
				store_id: tiendaDe.get(l.empleadoId) ?? 0,
				work_date: l.fecha,
				minutes: l.minutos,
				observations: (observaciones.get(l.empleadoId) ?? '').trim(),
				created_by: user?.id ?? '',
			})),
		);
	const sinTienda = lineas.some((l) => !tiendaDe.get(l.empleadoId));

	// Resumen para la confirmación: una entrada por persona, en el orden de la grilla.
	const resumen = useMemo<PersonaResumen[]>(() => {
		const nombreTienda = new Map(
			acceso.tiendasPermitidas.map((t) => [Number(t.id), t.name]),
		);
		return personas
			.map((p) => ({
				id: p.id,
				nombre: p.nombre,
				tienda: nombreTienda.get(tiendaDe.get(p.id) ?? -1) ?? '',
				observacion: (observaciones.get(p.id) ?? '').trim(),
				dias: lineas
					.filter((l) => l.empleadoId === p.id)
					.map((l) => ({
						fecha: l.fecha,
						minutos: l.minutos,
						yaRegistrada: existentes.has(l.clave),
					})),
			}))
			.filter((p) => p.dias.length > 0);
	}, [
		personas,
		lineas,
		tiendaDe,
		observaciones,
		existentes,
		acceso.tiendasPermitidas,
	]);
	const puedeRegistrar =
		lineas.length > 0 && errores.size === 0 && !excede && !sinTienda;

	return (
		<Paper
			elevation={0}
			sx={{ p: 2, borderRadius: 3, border: '1px solid #e0e0e0' }}
		>
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 2,
					mb: 2,
				}}
			>
				<Box>
					<Button
						startIcon={<ArrowBackIcon />}
						onClick={() => irA(REGISTRADAS)}
						size="small"
						sx={{ mb: 0.5 }}
					>
						Volver a registradas
					</Button>
					<Typography variant="h6" sx={{ fontWeight: 700, color: '#004680' }}>
						Registrar horas extras
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						Escribe las horas en la intersección persona / día. Las tiendas
						salen del selector de arriba. Quedan pendientes de aprobación.
					</Typography>
				</Box>
			</Box>

			{/* Filtros y accesos rápidos */}
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'flex-start',
					gap: 2,
					mb: 2,
				}}
			>
				<TextField
					label="Desde"
					type="date"
					size="small"
					value={desde}
					onChange={(e) => {
						setDesde(e.target.value);
						if (hasta < e.target.value) setHasta(e.target.value);
					}}
					slotProps={{
						inputLabel: { shrink: true },
						htmlInput: { max: hoy },
					}}
				/>
				<TextField
					label="Hasta"
					type="date"
					size="small"
					value={hasta}
					onChange={(e) => setHasta(e.target.value)}
					slotProps={{
						inputLabel: { shrink: true },
						htmlInput: { min: desde, max: hoy },
					}}
					error={!!errorRango}
					helperText={
						errorRango ??
						`${plural(dias.length, 'día', 'días')} (máximo ${MAX_DIAS_GRILLA})`
					}
				/>
				<TextField
					label="Buscar persona"
					placeholder="Nombre o documento"
					size="small"
					value={busqueda}
					onChange={(e) => {
						setBusqueda(e.target.value);
						setPage(0);
					}}
					sx={{ minWidth: 220 }}
				/>
			</Box>

			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					gap: 1.5,
					mb: 2,
					p: 1.5,
					borderRadius: 2,
					bgcolor: '#f8fafc',
					border: '1px solid #e2e8f0',
				}}
			>
				<Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
					Valor rápido
				</Typography>
				<ToggleButtonGroup
					exclusive
					size="small"
					value={VALORES_RAPIDOS.includes(valor) ? valor : null}
					onChange={(_, v: number | null) => v != null && setValor(v)}
					aria-label="Valor rápido"
				>
					{VALORES_RAPIDOS.map((v) => (
						<ToggleButton key={v} value={v} sx={{ textTransform: 'none' }}>
							{formatoMinutos(v)}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
				<TextField
					label="Otro (horas)"
					type="number"
					size="small"
					value={valor / 60}
					onChange={(e) => setValor(Math.round(Number(e.target.value) * 60))}
					slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
					sx={{ width: 120 }}
				/>
				<Button
					variant="outlined"
					size="small"
					disabled={seleccion.size === 0 || dias.length === 0 || valor <= 0}
					onClick={() =>
						poner(
							visibles
								.filter((p) => seleccion.has(p.id))
								.flatMap((p) => dias.map((d) => claveDia(p.id, d))),
							valor,
						)
					}
				>
					Aplicar a seleccionadas ({seleccion.size})
				</Button>
				<Button
					size="small"
					onClick={() => setSeleccion(new Set(visibles.map((p) => p.id)))}
					disabled={visibles.length === 0}
				>
					Seleccionar todas
				</Button>
				<Button
					size="small"
					onClick={() => setSeleccion(new Set())}
					disabled={seleccion.size === 0}
				>
					Quitar selección
				</Button>
				<Button
					size="small"
					color="error"
					onClick={() => setCeldas(new Map())}
					disabled={celdas.size === 0}
				>
					Limpiar horas
				</Button>
				{valor % BLOQUE_MINUTOS !== 0 && (
					<Typography variant="caption" sx={{ color: '#d32f2f' }}>
						El valor debe ir en bloques de media hora
					</Typography>
				)}
			</Box>

			{storeIds.length === 0 ? (
				<Alert severity="info">No tienes tiendas asignadas.</Alert>
			) : cargandoEmpleados ? (
				<Box
					sx={{ p: 5, textAlign: 'center' }}
					role="status"
					aria-live="polite"
				>
					<CircularProgress size={32} sx={{ color: '#004680' }} />
					<Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
						Cargando personas de {plural(storeIds.length, 'tienda', 'tiendas')}
						...
					</Typography>
				</Box>
			) : dias.length === 0 ? (
				<Alert severity="warning">
					{errorRango ?? 'Elige el rango de fechas'}
				</Alert>
			) : visibles.length === 0 ? (
				<Alert severity="info">No hay personas con ese filtro.</Alert>
			) : (
				<>
					{/* Barra fina: pintando otra página/filtro o comprobando las ya registradas. */}
					<Box sx={{ height: 4, mb: 0.5 }}>
						{(pintando || comprobando) && (
							<LinearProgress
								aria-label={
									pintando
										? 'Actualizando la grilla'
										: 'Comprobando horas extras ya registradas'
								}
							/>
						)}
					</Box>
					<GrillaHorasExtras
						personas={paginaDiferida}
						dias={dias}
						celdas={celdas}
						existentes={existentes}
						errores={errores}
						seleccion={seleccion}
						observaciones={observaciones}
						tiendaDe={tiendaDe}
						tiendas={tiendasGrilla}
						valorTexto={formatoMinutos(valor)}
						onCelda={onCelda}
						onSeleccion={onSeleccion}
						onObservacion={onObservacion}
						onTienda={onTienda}
						onRellenarFila={onRellenarFila}
						onRellenarColumna={onRellenarColumna}
					/>
					{visibles.length > rowsPerPage && (
						<ReporteTiendasPagination
							page={actual}
							totalPages={totalPages}
							rowsPerPage={rowsPerPage}
							totalRecords={visibles.length}
							onPageChange={setPage}
							onRowsPerPageChange={(n) => {
								setRowsPerPage(n);
								setPage(0);
							}}
						/>
					)}
				</>
			)}

			{/* Resumen y acción */}
			<Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
				{errores.size > 0 && (
					<Alert severity="error">
						{plural(errores.size, 'celda tiene', 'celdas tienen')} errores
						(marcadas en rojo; pasa el cursor para ver el detalle).
					</Alert>
				)}
				{conExistente > 0 && (
					<Alert severity="warning">
						{plural(conExistente, 'celda coincide', 'celdas coinciden')} con una
						hora extra ya registrada ese día. Puedes registrar igual.
					</Alert>
				)}
				{excede && (
					<Alert severity="error">
						El máximo por registro es {MAX_LINEAS_LOTE} horas extras.
					</Alert>
				)}
				<Box
					sx={{
						display: 'flex',
						flexWrap: 'wrap',
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: 2,
					}}
				>
					<Typography
						variant="body2"
						sx={{ color: '#334155' }}
						aria-live="polite"
					>
						<strong>
							{plural(lineas.length, 'hora extra', 'horas extras')}
						</strong>{' '}
						para {plural(personasConHoras, 'persona', 'personas')},{' '}
						{formatoMinutos(totalMinutos)} en total
					</Typography>
					<Box sx={{ display: 'flex', gap: 1 }}>
						<Button
							onClick={() => irA(REGISTRADAS)}
							disabled={guardar.isPending}
						>
							Cancelar
						</Button>
						<Button
							variant="contained"
							onClick={() => setConfirmando(true)}
							disabled={!puedeRegistrar || guardar.isPending}
							startIcon={
								guardar.isPending ? <CircularProgress size={16} /> : undefined
							}
						>
							Registrar ({lineas.length})
						</Button>
					</Box>
				</Box>
			</Box>
			<ConfirmarRegistroDialog
				open={confirmando}
				personas={resumen}
				guardando={guardar.isPending}
				onClose={() => setConfirmando(false)}
				onConfirmar={registrar}
			/>
		</Paper>
	);
}
