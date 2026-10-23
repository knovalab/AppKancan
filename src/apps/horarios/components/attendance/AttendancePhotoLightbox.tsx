import { Dialog, IconButton as MuiIconButton } from '@mui/material';
import { X } from 'lucide-react';

export interface AttendancePhotoLightboxProps {
	open: boolean;
	onClose: () => void;
	photoUrl: string | null;
	title?: string;
	subtitle?: string;
}

export function AttendancePhotoLightbox({
	open,
	onClose,
	photoUrl,
	title,
	subtitle,
}: AttendancePhotoLightboxProps) {
	if (!photoUrl) return null;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						borderRadius: 3.5,
						overflow: 'hidden',
						bgcolor: '#0f172a',
					},
				},
			}}
		>
			<div className="flex items-center justify-between px-4 py-3 bg-[#004680] text-white">
				<div className="min-w-0 pr-2">
					{title && (
						<h3 className="text-sm font-bold capitalize truncate">{title}</h3>
					)}
					{subtitle && (
						<p className="text-xs text-white/80 truncate">{subtitle}</p>
					)}
				</div>
				<MuiIconButton
					onClick={onClose}
					sx={{ color: '#fff' }}
					size="small"
					aria-label="Cerrar vista previa"
				>
					<X size={18} />
				</MuiIconButton>
			</div>
			<div className="p-3 flex items-center justify-center min-h-[300px]">
				<img
					src={photoUrl}
					alt={title || 'Foto de verificación'}
					className="max-h-[70vh] w-auto rounded-xl object-contain shadow-2xl"
				/>
			</div>
		</Dialog>
	);
}
