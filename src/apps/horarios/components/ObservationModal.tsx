/**
 * ObservationModal has evolved into DailyAttendanceModal to show full daily
 * attendance details (timestamps, photos, GPS data, and observations).
 * This re-export is maintained for backwards compatibility.
 */
export {
	DailyAttendanceModal,
	DailyAttendanceModal as ObservationModal,
	DailyAttendanceModal as default,
	type DailyAttendanceModalProps,
	type DailyAttendanceModalProps as ObservationModalProps,
} from './DailyAttendanceModal';
