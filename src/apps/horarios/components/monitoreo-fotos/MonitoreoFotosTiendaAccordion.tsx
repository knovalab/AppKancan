import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
	Accordion,
	AccordionDetails,
	AccordionSummary,
	Box,
	Chip,
	Divider,
	Typography,
} from '@mui/material';
import { useState } from 'react';
import type { FotoStoreGroup } from '../../hooks/useMonitoreoFotos';
import { MonitoreoFotosSeccion } from './MonitoreoFotosSeccion';

export interface MonitoreoFotosTiendaAccordionProps {
	storeGroup: FotoStoreGroup;
	defaultExpanded?: boolean;
}

export function MonitoreoFotosTiendaAccordion({
	storeGroup,
	defaultExpanded = false,
}: MonitoreoFotosTiendaAccordionProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	return (
		<Accordion
			expanded={expanded}
			onChange={(_event, isExpanded) => setExpanded(isExpanded)}
			slotProps={{ transition: { unmountOnExit: true } }}
			disableGutters
			elevation={0}
			sx={{
				borderRadius: '16px !important',
				border: '1px solid #e2e8f0',
				bgcolor: '#ffffff',
				overflow: 'hidden',
				mb: 2,
				boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
				'&:before': {
					display: 'none',
				},
				'&.Mui-expanded': {
					margin: '0 0 16px 0',
					borderColor: '#cbd5e1',
				},
			}}
		>
			<AccordionSummary
				expandIcon={<ExpandMoreIcon sx={{ color: '#004680' }} />}
				sx={{
					px: { xs: 1.5, sm: 2.5 },
					py: { xs: 0.75, sm: 1 },
					bgcolor: '#f8fafc',
					borderBottom: '1px solid #e2e8f0',
					minHeight: { xs: 58, sm: 64 },
					'&.Mui-expanded': {
						minHeight: { xs: 58, sm: 64 },
					},
					'& .MuiAccordionSummary-content': {
						alignItems: 'center',
						justifyContent: 'space-between',
						gap: { xs: 1, sm: 1.5 },
						my: 1,
						minWidth: 0,
					},
				}}
			>
				{/* Store identity: Icon + Name */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: { xs: 1, sm: 1.5 },
						minWidth: 0,
						flex: 1,
						pr: 1,
					}}
				>
					<Box
						sx={{
							width: { xs: 34, sm: 40 },
							height: { xs: 34, sm: 40 },
							borderRadius: 2,
							bgcolor: '#e0f2fe',
							color: '#004680',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							flexShrink: 0,
						}}
					>
						<StorefrontIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
					</Box>
					<Box sx={{ minWidth: 0, flex: 1 }}>
						<Typography
							variant="subtitle1"
							sx={{
								fontWeight: 700,
								color: '#0f172a',
								fontSize: { xs: '0.92rem', sm: '1.05rem' },
								lineHeight: 1.3,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
							}}
						>
							{storeGroup.storeName}
						</Typography>
						<Typography
							variant="caption"
							sx={{
								color: '#64748b',
								fontWeight: 500,
								fontSize: { xs: '0.72rem', sm: '0.75rem' },
							}}
						>
							{storeGroup.dates.length}{' '}
							{storeGroup.dates.length === 1
								? 'fecha con fotos'
								: 'fechas con fotos'}
						</Typography>
					</Box>
				</Box>

				{/* Total photos badge */}
				<Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
					<Chip
						label={`${storeGroup.totalPhotos} ${storeGroup.totalPhotos === 1 ? 'foto' : 'fotos'}`}
						size="small"
						sx={{
							bgcolor: '#004680',
							color: '#ffffff',
							fontWeight: 700,
							fontSize: { xs: '0.75rem', sm: '0.8rem' },
							height: { xs: 26, sm: 28 },
							px: 0.5,
						}}
					/>
				</Box>
			</AccordionSummary>

			<AccordionDetails
				sx={{
					p: { xs: 1.5, sm: 2.5 },
					display: 'flex',
					flexDirection: 'column',
					gap: { xs: 2, sm: 3 },
				}}
			>
				{expanded &&
					storeGroup.dates.map((dateGroup, dateIdx) => (
						<Box
							key={dateGroup.date}
							sx={{
								display: 'flex',
								flexDirection: 'column',
								gap: 2,
							}}
						>
							{/* Row for Date - ensures no mixing of dates */}
							<Box
								sx={{
									display: 'flex',
									alignItems: { xs: 'flex-start', sm: 'center' },
									justifyContent: 'space-between',
									flexDirection: { xs: 'column', sm: 'row' },
									gap: { xs: 1, sm: 1.5 },
									p: { xs: 1.25, sm: 1.5 },
									px: { xs: 1.5, sm: 2 },
									bgcolor: '#f1f5f9',
									borderRadius: 2.5,
									border: '1px solid #e2e8f0',
								}}
							>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										gap: 1,
										flexWrap: 'wrap',
										minWidth: 0,
									}}
								>
									<CalendarTodayIcon
										sx={{
											fontSize: { xs: 16, sm: 18 },
											color: '#004680',
											flexShrink: 0,
										}}
									/>
									<Typography
										variant="subtitle2"
										sx={{
											fontWeight: 700,
											color: '#1e293b',
											fontSize: { xs: '0.88rem', sm: '0.95rem' },
										}}
									>
										{dateGroup.dateLabel}
									</Typography>
									<Typography
										variant="caption"
										sx={{
											color: '#64748b',
											bgcolor: '#e2e8f0',
											px: 0.75,
											py: 0.2,
											borderRadius: 1.5,
											fontWeight: 600,
											fontSize: '0.72rem',
										}}
									>
										{dateGroup.dateFormatted}
									</Typography>
								</Box>

								<Chip
									label={
										<Box component="span">
											<Box
												component="span"
												sx={{ display: { xs: 'none', sm: 'inline' } }}
											>
												{dateGroup.totalPhotos}{' '}
												{dateGroup.totalPhotos === 1
													? 'foto en este día'
													: 'fotos en este día'}
											</Box>
											<Box
												component="span"
												sx={{ display: { xs: 'inline', sm: 'none' } }}
											>
												{dateGroup.totalPhotos}{' '}
												{dateGroup.totalPhotos === 1 ? 'foto' : 'fotos'}
											</Box>
										</Box>
									}
									size="small"
									variant="outlined"
									sx={{
										borderColor: '#cbd5e1',
										color: '#334155',
										fontWeight: 600,
										bgcolor: '#ffffff',
										fontSize: '0.75rem',
										height: 24,
										alignSelf: { xs: 'flex-start', sm: 'center' },
									}}
								/>
							</Box>

							{/* Sections for each log_type for this date (no title if empty) */}
							<Box
								sx={{
									display: 'flex',
									flexDirection: 'column',
									gap: 2.5,
									pl: { xs: 0, sm: 1 },
								}}
							>
								{dateGroup.sections.map((section) => (
									<MonitoreoFotosSeccion
										key={`${dateGroup.date}-${section.logType}`}
										logType={section.logType}
										records={section.records}
									/>
								))}
							</Box>

							{/* Separator between dates if not last */}
							{dateIdx < storeGroup.dates.length - 1 && (
								<Divider sx={{ my: 1, borderColor: '#e2e8f0' }} />
							)}
						</Box>
					))}
			</AccordionDetails>
		</Accordion>
	);
}
