import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Box, Button, Typography } from '@mui/material';

export interface ReporteTiendasHeaderProps {
	totalRecords: number;
	onExportExcel?: () => void;
}

export function ReporteTiendasHeader({
	totalRecords,
	onExportExcel,
}: ReporteTiendasHeaderProps) {
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				flexWrap: 'wrap',
				gap: 2,
			}}
		>
			<Typography
				variant="subtitle2"
				sx={{ fontWeight: 700, color: '#334155' }}
			>
				Jornadas de Tienda ({totalRecords} registros)
			</Typography>

			{onExportExcel && (
				<Button
					variant="outlined"
					size="small"
					startIcon={<FileDownloadIcon />}
					onClick={onExportExcel}
					sx={{
						textTransform: 'none',
						fontWeight: 700,
						borderColor: '#004680',
						color: '#004680',
						borderRadius: 2,
						'&:hover': {
							borderColor: '#003366',
							bgcolor: '#f0f7ff',
						},
					}}
				>
					Exportar este reporte
				</Button>
			)}
		</Box>
	);
}
