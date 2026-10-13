import { Box, Tooltip } from '@mui/material';
import {
	PickersDay,
	type PickersDayProps,
} from '@mui/x-date-pickers/PickersDay';
import dayjs from 'dayjs';
import type { HolidayMap } from '../../reservas/hooks/useHolidays';

interface FestivoDayProps extends PickersDayProps {
	holidays?: HolidayMap;
}

export const FestivoDay = (props: FestivoDayProps) => {
	const { holidays = {}, day, outsideCurrentMonth, ...other } = props;
	const dateStr = dayjs(day).format('YYYY-MM-DD');
	const name = holidays[dateStr];
	const isHoliday = Boolean(name) && !outsideCurrentMonth;

	// Early return if not a holiday - render default PickersDay
	if (!isHoliday) {
		return (
			<PickersDay
				{...other}
				day={day}
				outsideCurrentMonth={outsideCurrentMonth}
			/>
		);
	}

	return (
		<Tooltip title={name} arrow placement="top">
			<Box sx={{ position: 'relative', display: 'inline-flex' }}>
				<PickersDay
					{...other}
					day={day}
					outsideCurrentMonth={outsideCurrentMonth}
					sx={{
						backgroundColor: '#fef2f2',
						color: '#b91c1c',
						'&:hover': { backgroundColor: '#fee2e2' },
					}}
				/>
				<Box
					sx={{
						position: 'absolute',
						top: 2,
						right: 2,
						width: 5,
						height: 5,
						borderRadius: '50%',
						backgroundColor: '#dc2626',
						pointerEvents: 'none',
					}}
				/>
			</Box>
		</Tooltip>
	);
};
