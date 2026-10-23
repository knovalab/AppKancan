import { Box, Pagination, Paper, Typography } from '@mui/material';
import { forwardRef } from 'react';
import { rowsPerPage } from './MonitoreoUtils';

export const Paginador = ({ count, page, setPage, label, total }: any) => {
	const start = page * rowsPerPage.tiendas;
	const end = Math.min(start + rowsPerPage.tiendas, total);
	const showing = Math.max(0, end - start);

	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				px: 2.5,
				py: 1.5,
				borderTop: '1px solid #e0e0e0',
				flexWrap: 'wrap',
				gap: 1,
			}}
		>
			<Typography variant="body2" color="text.secondary" fontWeight={500}>
				Mostrando <strong>{showing}</strong> de <strong>{total}</strong> {label}
			</Typography>
			{total > rowsPerPage.tiendas && (
				<Pagination
					count={count}
					page={page + 1}
					onChange={(_, p) => setPage(p - 1)}
					color="primary"
					shape="rounded"
					size="small"
					showFirstButton
					showLastButton
					sx={{
						'& .MuiPaginationItem-root': {
							borderRadius: 2,
							border: '1px solid #e0e0e0',
							margin: '0 2px',
							'&.Mui-selected': {
								bgcolor: '#004680',
								color: '#fff',
								borderColor: '#004680',
								'&:hover': { bgcolor: '#003366' },
							},
							'&:hover': { bgcolor: '#f5f7fa' },
						},
					}}
				/>
			)}
		</Box>
	);
};

export const TarjetaResumen = forwardRef<HTMLDivElement, any>(
	({ icon: Icon, label, value, color, ...props }, ref) => (
		<Box
			ref={ref}
			{...props}
			sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
		>
			<Icon sx={{ color }} />
			<Box>
				<Typography
					variant="caption"
					color="text.secondary"
					display="block"
					fontWeight={600}
				>
					{label}
				</Typography>
				<Typography variant="h6" fontWeight={700} color={color}>
					{value}
				</Typography>
			</Box>
		</Box>
	),
);

export const TarjetaEstadistica = ({
	icon: Icon,
	label,
	value,
	color,
	bg,
	onClick,
}: any) => (
	<Paper
		elevation={0}
		sx={{
			p: 2,
			borderRadius: 3,
			border: '1px solid #e0e0e0',
			display: 'flex',
			alignItems: 'center',
			gap: 1.5,
			...(onClick
				? {
						cursor: 'pointer',
						transition: 'all 0.2s',
						'&:hover': {
							borderColor: '#004680',
							boxShadow: '0 2px 8px rgba(0,70,128,0.15)',
						},
					}
				: {}),
		}}
		onClick={onClick}
	>
		<Box
			sx={{
				bgcolor: bg,
				p: 1,
				borderRadius: 2,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<Icon sx={{ color, fontSize: 22 }} />
		</Box>
		<Box sx={{ minWidth: 0, width: '100%' }}>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				fontWeight={600}
			>
				{label}
			</Typography>
			<Typography
				variant="body2"
				fontWeight={700}
				color={color}
				noWrap
				title={String(value)}
				sx={{
					lineHeight: 1.3,
					display: '-webkit-box',
					WebkitLineClamp: 2,
					WebkitBoxOrient: 'vertical',
					overflow: 'hidden',
					wordBreak: 'break-word',
				}}
			>
				{value}
			</Typography>
		</Box>
	</Paper>
);
