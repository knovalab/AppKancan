import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
	Box,
	Button,
	Checkbox,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	List,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { listarHorasExtras } from '../../api/directus/horasExtras';
import { getStores } from '../../api/directus/read';
import {
	clasificarParaPeriodo,
	ESTADO_PERIODO,
} from '../../domain/horasExtras';
import { horariosKeys } from '../../hooks/registro/keys';
import { useAvisos } from '../../hooks/useAvisos';
import { filtrosDePeriodo } from '../../hooks/usePeriodos';
import type { PeriodDto } from '../../interfaces/api/period';
import type { Tienda } from '../../interfaces/tiendas';
import { mensajeDeError } from '../../utils/errores';
import {
	exportarPeriodosExcel,
	hojasExportacionPeriodos,
} from '../../utils/exportarPeriodos';
import { PeriodoEstadoChip } from './PeriodoEstadoChip';

export interface ExportarPeriodosDialogProps {
	open: boolean;
	/** Todos los periodos (más reciente primero). */
	periodos: PeriodDto[];
	onClose: () => void;
}

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');

/**
 * Exporta a Excel uno o varios periodos: una hoja por empresa y, en cada hoja,
 * un bloque por periodo con su cabecera y el total por empleado y tienda.
 */
export function ExportarPeriodosDialog({
	open,
	periodos,
	onClose,
}: ExportarPeriodosDialogProps) {
	const queryClient = useQueryClient();
	const { showSnackbar } = useAvisos();
	// Por defecto, el más reciente.
	const [seleccion, setSeleccion] = useState<ReadonlySet<number>>(
		() => new Set(periodos[0] ? [periodos[0].id] : []),
	);
	const [exportando, setExportando] = useState(false);
	// Misma clave que useHorariosAcceso: sale de la caché.
	const { data: tiendas = [] } = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		staleTime: 30 * 60 * 1000,
	});

	const alternar = (id: number) =>
		setSeleccion((prev) => {
			const sig = new Set(prev);
			if (sig.has(id)) sig.delete(id);
			else sig.add(id);
			return sig;
		});

	const exportar = async () => {
		// Orden cronológico en el archivo.
		const elegidos = periodos
			.filter((p) => seleccion.has(p.id))
			.sort((a, b) => a.start_date.localeCompare(b.start_date));
		setExportando(true);
		try {
			const datos = await Promise.all(
				elegidos.map(async (periodo) => {
					const filtros = filtrosDePeriodo(periodo, periodos);
					const horas = await queryClient.fetchQuery({
						queryKey: horariosKeys.horasExtras.lista(filtros),
						queryFn: () => listarHorasExtras(filtros),
						staleTime: 60 * 1000,
					});
					if (periodo.status === ESTADO_PERIODO.liquidado)
						return { periodo, horas };
					// Preliquidado: lo que se vincularía hoy (del periodo + rezagadas).
					const { delPeriodo, rezagadas } = clasificarParaPeriodo(
						horas,
						periodo,
						periodos,
					);
					return { periodo, horas: [...delPeriodo, ...rezagadas] };
				}),
			);
			await exportarPeriodosExcel(hojasExportacionPeriodos(datos, tiendas));
			showSnackbar('Excel de periodos generado', 'success');
			onClose();
		} catch (error) {
			showSnackbar(
				mensajeDeError(error, 'Error al exportar los periodos'),
				'error',
			);
		} finally {
			setExportando(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={exportando ? undefined : onClose}
			fullWidth
			maxWidth="sm"
			aria-labelledby="exportar-periodos-titulo"
		>
			<DialogTitle
				id="exportar-periodos-titulo"
				sx={{ fontWeight: 700, color: '#004680' }}
			>
				Exportar periodos a Excel
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					Una hoja por empresa, con el total de horas por empleado y tienda.
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						mb: 1,
					}}
				>
					<Typography
						variant="body2"
						sx={{ fontWeight: 600 }}
						aria-live="polite"
					>
						{seleccion.size} de {periodos.length} seleccionados
					</Typography>
					<Box>
						<Button
							size="small"
							onClick={() => setSeleccion(new Set(periodos.map((p) => p.id)))}
							disabled={seleccion.size === periodos.length}
						>
							Seleccionar todos
						</Button>
						<Button
							size="small"
							onClick={() => setSeleccion(new Set())}
							disabled={seleccion.size === 0}
						>
							Quitar todos
						</Button>
					</Box>
				</Box>
				<List
					dense
					aria-label="Periodos"
					sx={{
						maxHeight: 360,
						overflow: 'auto',
						border: '1px solid #e2e8f0',
						borderRadius: 2,
						py: 0,
					}}
				>
					{periodos.map((p) => {
						const nombre = p.name || 'Sin nombre';
						return (
							<ListItemButton
								key={p.id}
								onClick={() => alternar(p.id)}
								selected={seleccion.has(p.id)}
							>
								<ListItemIcon sx={{ minWidth: 36 }}>
									<Checkbox
										edge="start"
										size="small"
										checked={seleccion.has(p.id)}
										tabIndex={-1}
										disableRipple
										slotProps={{
											input: {
												'aria-label': `${nombre}, del ${fecha(p.start_date)} al ${fecha(p.end_date)}`,
											},
										}}
									/>
								</ListItemIcon>
								<ListItemText
									primary={nombre}
									secondary={`Del ${fecha(p.start_date)} al ${fecha(p.end_date)}`}
								/>
								<PeriodoEstadoChip estado={p.status} />
							</ListItemButton>
						);
					})}
				</List>
				{periodos.some(
					(p) => seleccion.has(p.id) && p.status !== ESTADO_PERIODO.liquidado,
				) && (
					<Typography
						variant="caption"
						sx={{ display: 'block', mt: 1, color: '#64748b' }}
					>
						Los periodos preliquidados se exportan como vista previa (lo que se
						vincularía hoy).
					</Typography>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} disabled={exportando}>
					Cancelar
				</Button>
				<Button
					variant="contained"
					startIcon={
						exportando ? <CircularProgress size={16} /> : <FileDownloadIcon />
					}
					onClick={exportar}
					disabled={exportando || seleccion.size === 0}
				>
					Exportar ({seleccion.size})
				</Button>
			</DialogActions>
		</Dialog>
	);
}
