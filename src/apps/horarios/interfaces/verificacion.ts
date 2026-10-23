/** Evidencia de una marcación: foto (UUID de directus_files) + ubicación GPS. */
export interface VerificationData {
	latitude: number;
	longitude: number;
	accuracy: number;
	/** UUID del archivo en directus_files. */
	photo: string;
}
