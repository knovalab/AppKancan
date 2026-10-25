import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Alert, Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReporteTiendasPagination } from '../../components/com_time_record_store';
import { CrearPeriodoModal } from '../../components/horas-extras/CrearPeriodoModal';
import { ExportarPeriodosDialog } from '../../components/horas-extras/ExportarPeriodosDialog';
import { PeriodoDetalleDialog } from '../../components/horas-extras/PeriodoDetalleDialog';
import { PeriodosTabla } from '../../components/horas-extras/PeriodosTabla';
import {
	AVISO_SOLO_LIQUIDADOS,
	ESTADO_PERIODO,
} from '../../domain/horasExtras';
import { usePeriodosConTotales } from '../../hooks/usePeriodos';
import { mensajeDeError } from '../../utils/errores';

const PARAM_PERIODO = 'periodo';

export default function PeriodosPage() {
	const { periodos, filas, isLoading, error } = usePeriodosConTotales();
	const [params, setParams] = useSearchParams();
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [aperturas, setAperturas] = useState(0);
	const [creando, setCreando] = useState(false);
	const [exportando, setExportando] = useState(false);

	const hayLiquidados = periodos.some(
		(p) => p.status === ESTADO_PERIODO.liquidado,
	);
	const abiertoId = Number(params.get(PARAM_PERIODO));
	const abierto = periodos.find((p) => p.id === abiertoId);
	const cambiarAbierto = (id: number | null) =>
		setParams(
			(prev) => {
				const sig = new URLSearchParams(prev);
				if (id == null) sig.delete(PARAM_PERIODO);
				else sig.set(PARAM_PERIODO, String(id));
				return sig;
			},
			{ replace: true },
		);

	const totalPages = Math.max(1, Math.ceil(filas.length / rowsPerPage));
	const actual = Math.min(page, totalPages - 1);
	const pagina = filas.slice(actual * rowsPerPage, (actual + 1) * rowsPerPage);

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
					<Typography variant="h6" sx={{ fontWeight: 700, color: '#004680' }}>
						Periodos de nómina
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						{filas.length} periodo{filas.length !== 1 ? 's' : ''} · todas las
						tiendas
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
					{/* El span deja mostrar el tooltip con el botón deshabilitado. */}
					<Tooltip title={hayLiquidados ? '' : AVISO_SOLO_LIQUIDADOS}>
						<span>
							<Button
								variant="outlined"
								startIcon={<FileDownloadIcon />}
								disabled={isLoading || !hayLiquidados}
								onClick={() => {
									setAperturas((n) => n + 1);
									setExportando(true);
								}}
							>
								Exportar a Excel
							</Button>
						</span>
					</Tooltip>
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						disabled={isLoading}
						onClick={() => {
							setAperturas((n) => n + 1);
							setCreando(true);
						}}
					>
						Crear periodo
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar los periodos')}
				</Alert>
			)}

			<PeriodosTabla
				filas={pagina}
				loading={isLoading}
				onAbrir={(p) => cambiarAbierto(p.id)}
			/>
			{filas.length > 0 && (
				<ReporteTiendasPagination
					page={actual}
					totalPages={totalPages}
					rowsPerPage={rowsPerPage}
					totalRecords={filas.length}
					onPageChange={setPage}
					onRowsPerPageChange={(n) => {
						setRowsPerPage(n);
						setPage(0);
					}}
				/>
			)}

			<ExportarPeriodosDialog
				key={`exportar-${aperturas}`}
				open={exportando}
				periodos={periodos}
				onClose={() => setExportando(false)}
			/>
			<CrearPeriodoModal
				key={aperturas}
				open={creando}
				periodos={periodos}
				onClose={() => setCreando(false)}
			/>
			<PeriodoDetalleDialog
				key={abierto?.id}
				periodo={abierto}
				periodos={periodos}
				onClose={() => cambiarAbierto(null)}
			/>
		</Paper>
	);
}
