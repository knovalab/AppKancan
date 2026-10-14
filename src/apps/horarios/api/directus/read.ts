import dayjs from "dayjs";
import directus from "@/services/directus/directus";
import { withAutoRefresh } from "@/auth/services/directusInterceptor";
import { readItems, readMe } from "@directus/sdk";
import { EmpleadoAsistencia, TipoNovedad, Tienda, Cargo, EmpleadoAdmin, Motivo } from "../../interfaces/horarios.interface";
import { getEmpleadosBulk, getStoreClosedDays } from "./readBulk";
export { getStoreClosedDays };

// Tienda "Oficina" usada para pruebas.
export const STORE_PRUEBAS = 90;

export async function getStoreIdUsuarioActual(): Promise<number | null> {
  try {
    const me: any = await withAutoRefresh(() =>
      directus.request(readMe({ fields: ["store_id", "store.id"] as any }))
    );
    const raw = me?.store_id ?? me?.store?.id ?? null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch (error) {
    console.error("❌ Error obteniendo store_id del usuario (readMe):", error);
    return null;
  }
}

/**
 * Reutiliza getEmpleadosBulk([storeId]) para evitar duplicar código de mapeo de empleados.
 */
export async function getEmpleados(storeId: number): Promise<EmpleadoAsistencia[]> {
  return getEmpleadosBulk([storeId]);
}

export async function getTiposNovedad(): Promise<TipoNovedad[]> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("com_newness", {
          fields: ["id", "name"],
        })
      )
    );
    return (items || []).map((t: any) => ({
      id: t.id,
      nombre: t.name,
      name: t.name,
    }));
  } catch (error) {
    console.error("❌ Error cargando com_newness:", error);
    return [];
  }
}

export async function getReasons(): Promise<Motivo[]> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("com_reasons", {
          fields: ["id", "name"],
          filter: { status: { _eq: true } },
          sort: ["name"],
          limit: -1,
        })
      )
    );
    const motivos = (items || []).map((r: any) => ({ id: Number(r.id), name: r.name || "" }));
    return motivos.sort((a: Motivo, b: Motivo) => {
      const aOtro = a.name.trim().toLowerCase() === "otro";
      const bOtro = b.name.trim().toLowerCase() === "otro";
      if (aOtro !== bOtro) return aOtro ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error("❌ Error cargando com_reasons:", error);
    return [];
  }
}

export async function getReasonNamesForRecords(recordIds: number[]): Promise<Map<number, string>> {
  const mapa = new Map<number, string>();
  if (!recordIds || recordIds.length === 0) return mapa;
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("com_records_reasons", {
          fields: ["records_id", "reasons_id.name"],
          filter: { records_id: { _in: recordIds } },
          limit: -1,
        })
      )
    );
    (items || []).forEach((it: any) => {
      const rid = Number(typeof it.records_id === "object" ? it.records_id?.id : it.records_id);
      const nombre = it.reasons_id?.name ?? null;
      if (Number.isFinite(rid) && nombre) mapa.set(rid, nombre);
    });
    return mapa;
  } catch (error) {
    console.error("❌ Error obteniendo motivos de los registros:", error);
    return mapa;
  }
}

export async function getRecordReasonId(recordId: number): Promise<number | null> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("com_records_reasons", {
          fields: ["reasons_id"],
          filter: { records_id: { _eq: recordId } },
          limit: 1,
        })
      )
    );
    const raw = (items || [])[0]?.reasons_id;
    if (raw == null) return null;
    const id = Number(typeof raw === "object" ? raw.id : raw);
    return Number.isFinite(id) ? id : null;
  } catch (error) {
    console.error("❌ Error obteniendo motivo del registro:", error);
    return null;
  }
}

/**
 * Reutiliza getStoreNovedades para evitar duplicar código de la tabla com_newness_reports.
 */
export async function getNovedades(storeId: number): Promise<any[]> {
  try {
    const filter: any = {};
    if (storeId != null && Number(storeId) > 0) {
      filter.store_id = { _eq: storeId };
    }
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems('com_newness_reports', {
          fields: ['*', 'newness_id.*', 'employee_id.*', 'store_id.*'],
          filter,
          sort: ['-report_date', '-id'],
          limit: -1
        })
      )
    );
    return (items || []).map((nov: any) => {
      const emp = nov.employee_id || {};
      const parts = [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name].filter(Boolean);
      const fullName = parts.join(' ');
      return {
        ...nov,
        id: nov.id,
        fecha: nov.report_date || (nov.date_created ? dayjs(nov.date_created).format('YYYY-MM-DD') : ''),
        report_date: nov.report_date || (nov.date_created ? dayjs(nov.date_created).format('YYYY-MM-DD') : ''),
        employee_id: emp,
        empleadoId: emp.id,
        empleadoNombre: fullName || `Empleado #${emp.id || ''}`,
        tipo: nov.newness_id?.name || 'Novedad',
        observaciones: nov.observations || '',
        empleadoActivo: emp.status === 'Activo',
        tiendaNombre: nov.store_id?.name || ''
      };
    });
  } catch (error) {
    console.error('❌ Error al obtener novedades:', error);
    return [];
  }
}

export async function getStoreNovedades(storeId: number | number[] | null): Promise<any[]> {
  try {
    const filter: any = {};
    if (storeId != null && (Array.isArray(storeId) ? storeId.length > 0 : Number(storeId) > 0)) {
      if (Array.isArray(storeId)) {
        filter.store_id = { _in: storeId };
      } else {
        filter.store_id = { _eq: storeId };
      }
    }
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems('com_newness_reports', {
          fields: ['*', 'newness_id.*', 'employee_id.*', 'store_id.*'],
          filter,
          sort: ['-report_date', '-id'],
          limit: -1
        })
      )
    );
    return (items || []).map((nov: any) => {
      const emp = nov.employee_id || {};
      const parts = [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name].filter(Boolean);
      const fullName = parts.join(' ');
      return {
        ...nov,
        id: nov.id,
        fecha: nov.report_date || (nov.date_created ? dayjs(nov.date_created).format('YYYY-MM-DD') : ''),
        report_date: nov.report_date || (nov.date_created ? dayjs(nov.date_created).format('YYYY-MM-DD') : ''),
        employee_id: emp,
        empleadoId: emp.id,
        empleadoNombre: fullName || `Empleado #${emp.id || ''}`,
        empleadoDocumento: emp.document_number ? String(emp.document_number) : undefined,
        tipo: nov.newness_id?.name || 'Novedad',
        observaciones: nov.observations || '',
        empleadoActivo: emp.status === 'Activo',
        tiendaNombre: nov.store_id?.name || ''
      };
    });
  } catch (error) {
    console.error('❌ Error cargando novedades por tienda:', error);
    return [];
  }
}

export interface TimeRecord {
  id: number;
  record_date: string;
  record_time: string;
  original_record_time: string | null;
  log_type: string;
  employee_id: {
    id?: number | string;
    document_number?: string | number | null;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    second_last_name: string | null;
  } | null;
  store_id: { id: number; name: string } | string | null;
  observations: string | null;
}

export const fetchTimeRecords = async (
  fechaInicio?: string,
  fechaFin?: string,
  storeId?: number | number[],
  employeeId?: number | string
): Promise<TimeRecord[]> => {
  const filter: any = {};

  if (storeId != null && (Array.isArray(storeId) ? storeId.length > 0 : Number(storeId) > 0)) {
    if (Array.isArray(storeId)) {
      filter.store_id = { _in: storeId };
    } else {
      filter.store_id = { _eq: storeId };
    }
  }
  if (employeeId != null) {
    filter.employee_id = { _eq: Number(employeeId) };
  }
  if (fechaInicio) {
    filter.record_date = { ...filter.record_date, _gte: fechaInicio };
  }
  if (fechaFin) {
    filter.record_date = { ...filter.record_date, _lte: fechaFin };
  }

  return await withAutoRefresh(() =>
    directus.request(
      readItems('com_time_records', {
        fields: ['id', 'record_date', 'record_time', 'original_record_time', 'log_type', 'employee_id.id', 'employee_id.document_number', 'employee_id.first_name', 'employee_id.middle_name', 'employee_id.last_name', 'employee_id.second_last_name', 'store_id.id', 'store_id.name', 'observations'],
        filter,
        sort: ['-record_date'],
        limit: -1,
      })
    )
  ) as TimeRecord[];
};

/**
 * Id de la marcación (empleado, log_type, fecha) si ya existe en Directus; null si no.
 * Consulta fresca, sin caché: la usa el registro para rechazar marcaciones repetidas
 * aunque se hayan hecho desde otro dispositivo. Los errores se propagan.
 */
export async function getMarcacionExistenteId(
  employeeId: number,
  logType: string,
  date: string,
): Promise<number | null> {
  const items = (await withAutoRefresh(() =>
    directus.request(
      readItems('com_time_records', {
        fields: ['id'],
        filter: {
          _and: [
            { employee_id: { _eq: employeeId } },
            { log_type: { _eq: logType } },
            { record_date: { _eq: date } },
          ],
        },
        limit: 1,
      })
    )
  )) as { id: number }[];
  return items[0]?.id != null ? Number(items[0].id) : null;
}

/**
 * Reutiliza fetchTimeRecords(date, date, storeId) para evitar duplicar peticiones a com_time_records.
 */
export async function getTimeRecords(storeId: number, date: string): Promise<TimeRecord[]> {
  return fetchTimeRecords(date, date, storeId);
}

export async function getStores(): Promise<Tienda[]> {
  try {
    const data = await withAutoRefresh(() =>
      directus.request(
        readItems("core_stores", {
          fields: ["id", "name", "ultra_code", "company"],
          sort: ["name"],
          limit: -1,
        })
      )
    );
    return (data || []) as Tienda[];
  } catch (error) {
    console.error("❌ Error cargando core_stores:", error);
    return [];
  }
}

export async function getCargos(): Promise<Cargo[]> {
  try {
    const data = await withAutoRefresh(() =>
      directus.request(
        readItems("core_positions", {
          fields: ["id", "name"],
          sort: ["name"],
          limit: -1,
        })
      )
    );
    return (data || []).map((c: any) => ({ id: c.id, name: c.name || "Sin nombre" })) as Cargo[];
  } catch (error) {
    console.error("❌ Error cargando core_positions:", error);
    return [];
  }
}

/** Id de una relación M2O de Directus, venga como objeto `{ id }` o como valor plano. */
export const idRelacion = (val: unknown): number | null => {
  const raw = val != null && typeof val === "object" ? (val as { id?: unknown }).id : val;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const mapEmpleadoAdmin = (emp: any): EmpleadoAdmin => ({
  id: emp.id,
  document_type: emp.document_type ?? null,
  document_number: emp.document_number != null ? String(emp.document_number) : null,
  first_name: emp.first_name ?? null,
  middle_name: emp.middle_name ?? null,
  last_name: emp.last_name ?? null,
  second_last_name: emp.second_last_name ?? null,
  store_id: idRelacion(emp.store_id),
  position_id: idRelacion(emp.position_id),
  position_name: (typeof emp.position_id === "object" ? emp.position_id?.name : null) ?? null,
  status: emp.status ?? null,
});

export async function listarEmpleadosTienda(storeId: number): Promise<EmpleadoAdmin[]> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("adm_employees", {
          fields: [
            "id", "document_type", "document_number",
            "first_name", "middle_name", "last_name", "second_last_name",
            "store_id", "position_id.id", "position_id.name", "status",
          ],
          filter: { store_id: { _eq: storeId } },
          sort: ["first_name", "last_name"],
          limit: -1,
        })
      )
    );
    return (items || []).map(mapEmpleadoAdmin);
  } catch (error) {
    console.error("❌ Error listando empleados por tienda:", error);
    throw error;
  }
}

export async function listarTodosEmpleados(): Promise<EmpleadoAdmin[]> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("adm_employees", {
          fields: [
            "id", "document_type", "document_number",
            "first_name", "middle_name", "last_name", "second_last_name",
            "store_id", "position_id.id", "position_id.name", "status",
          ],
          sort: ["first_name", "last_name"],
          limit: -1,
        })
      )
    );
    return (items || []).map(mapEmpleadoAdmin);
  } catch (error) {
    console.error("❌ Error listando todos los empleados:", error);
    throw error;
  }
}

export async function buscarEmpleados(query: string): Promise<EmpleadoAdmin[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const esNumero = /^\d+$/.test(q);
    const tokens = q.split(/\s+/).filter(Boolean);
    const filter: any = esNumero
      ? { document_number: { _eq: Number(q) } }
      : {
          _and: tokens.map((tok) => ({
            _or: [
              { first_name: { _icontains: tok } },
              { middle_name: { _icontains: tok } },
              { last_name: { _icontains: tok } },
              { second_last_name: { _icontains: tok } },
            ],
          })),
        };

    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("adm_employees", {
          fields: [
            "id", "document_type", "document_number",
            "first_name", "middle_name", "last_name", "second_last_name",
            "store_id", "position_id.id", "position_id.name", "status",
          ],
          filter,
          sort: ["first_name", "last_name"],
          limit: 50,
        })
      )
    );
    return (items || []).map(mapEmpleadoAdmin);
  } catch (error) {
    console.error("❌ Error buscando empleados:", error);
    throw error;
  }
}

export async function existeDocumentoEmpleado(documentNumber: string): Promise<boolean> {
  const doc = documentNumber.trim();
  if (!doc) return false;
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("adm_employees", {
          fields: ["id"],
          filter: { document_number: { _eq: doc } },
          limit: 1,
        })
      )
    );
    return !!(items && items.length > 0);
  } catch (error) {
    console.error("❌ Error verificando existencia de documento:", error);
    return false;
  }
}

export async function getEditedTimeRecords(storeIds: number[], startDate: string, endDate: string): Promise<any[]> {
  try {
    const filter: any = {
      original_record_time: { _nnull: true },
      record_date: { _gte: startDate, _lte: endDate }
    };
    if (storeIds && storeIds.length > 0) {
      filter.store_id = { _in: storeIds };
    }

    const records = await withAutoRefresh(() =>
      directus.request(
        readItems('com_time_records', {
          fields: [
            'id',
            'record_date',
            'record_time',
            'original_record_time',
            'log_type',
            'employee_id.id',
            'employee_id.first_name',
            'employee_id.middle_name',
            'employee_id.last_name',
            'employee_id.second_last_name',
            'store_id.id',
            'store_id.name',
            'observations'
          ],
          filter,
          limit: -1,
          sort: ['-record_date']
        })
      )
    );

    if (!records || records.length === 0) return [];

    const recordIds = records.map((r: any) => r.id);
    const reasonsMap = await getReasonNamesForRecords(recordIds);

    return records.map((r: any) => {
      const emp = r.employee_id || {};
      const store = r.store_id || {};
      const fullName = [
        emp.first_name,
        emp.middle_name,
        emp.last_name,
        emp.second_last_name
      ].filter(Boolean).join(' ');

      return {
        id: r.id,
        fecha: r.record_date,
        empleadoId: emp.id,
        empleadoNombre: fullName || 'Empleado Desconocido',
        tiendaId: store.id,
        tiendaNombre: store.name || 'Sin Tienda',
        tipoRegistro: r.log_type,
        horaOriginal: r.original_record_time,
        horaModificada: r.record_time,
        motivo: reasonsMap.get(r.id) || 'Sin justificación',
        observaciones: r.observations || ''
      };
    });
  } catch (error) {
    console.error('❌ Error al obtener registros editados:', error);
    return [];
  }
}

export async function getPrimerPeriodoRegistro(): Promise<{ year: number; month: number }> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems('com_time_records', {
          fields: ['record_date'],
          sort: ['record_date'],
          limit: 1
        })
      )
    );
    if (items && items.length > 0 && items[0].record_date) {
      const date = dayjs(items[0].record_date);
      const year = date.year();
      const month = date.month();
      if (!isNaN(year) && !isNaN(month)) {
        return { year, month };
      }
    }
  } catch (error) {
    console.error('❌ Error al obtener el primer período de registro:', error);
  }
  return { year: dayjs().year(), month: 0 };
}

// Reexportar todas las consultas bulk y reportes
export * from "./readBulk";
export * from "./reports";
