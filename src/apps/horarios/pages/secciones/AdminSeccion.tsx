import { useState } from 'react';
import AdminEmpleadosPage from '../AdminEmpleadosPage';

/**
 * Sección "Admin" (/horarios/admin). Adaptador sobre `AdminEmpleadosPage`.
 * Admin tiene su propio filtro de tienda (`tienda: 'ninguno'` en el header) y lo
 * mantiene en estado local: así su reset al montarse ya no borra la tienda
 * seleccionada del resto de secciones.
 */
export default function AdminSeccion() {
	const [storeSel, setStoreSel] = useState<number | null>(null);
	return <AdminEmpleadosPage storeSel={storeSel} onStoreChange={setStoreSel} />;
}
