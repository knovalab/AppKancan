import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, IconButton, MenuItem, Select, Typography } from '@mui/material';

export interface ReporteTiendasPaginationProps {
	page: number;
	totalPages: number;
	rowsPerPage: number;
	totalRecords: number;
	onPageChange: (newPage: number) => void;
	onRowsPerPageChange: (newRowsPerPage: number) => void;
}

export function ReporteTiendasPagination({
	page,
	totalPages,
	rowsPerPage,
	totalRecords,
	onPageChange,
	onRowsPerPageChange,
}: ReporteTiendasPaginationProps) {
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				flexWrap: 'wrap',
				gap: 2,
				pt: 1,
			}}
		>
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					Filas por página:
				</Typography>
				<Select
					size="small"
					value={rowsPerPage}
					onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
					sx={{
						height: 32,
						bgcolor: '#f8fafc',
						'& .MuiSelect-select': { py: 0.5 },
					}}
				>
					<MenuItem value={5}>5</MenuItem>
					<MenuItem value={10}>10</MenuItem>
					<MenuItem value={25}>25</MenuItem>
					<MenuItem value={50}>50</MenuItem>
				</Select>
			</Box>

			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					Página {page + 1} de {totalPages} ({totalRecords} registros)
				</Typography>
				<IconButton
					size="small"
					disabled={page === 0}
					onClick={() => onPageChange(Math.max(0, page - 1))}
				>
					<ChevronLeftIcon />
				</IconButton>
				<IconButton
					size="small"
					disabled={page >= totalPages - 1}
					onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
				>
					<ChevronRightIcon />
				</IconButton>
			</Box>
		</Box>
	);
}
