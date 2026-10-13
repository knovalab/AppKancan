import directus from "@/services/directus/directus";
import { withAutoRefresh } from "@/auth/services/directusInterceptor";
import { readItems } from "@directus/sdk";
import type { EventReportHoy } from "../../interfaces/horarios.interface";
import { STORE_PRUEBAS, TimeRecord } from "./read";

export interface NewnessReport {
  id: number;
  report_date: string | null;
  date_created: string | null;
  observations: string | null;
  newness_id: { name?: string | null } | null;
  store_id: string | number | null;
  employee_id: {
    document_number?: string | number | null;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    second_last_name: string | null;
  } | null;
}

export const fetchTimeRecordsExport = async (
  fechaInicio?: string,
  fechaFin?: string,
  storeIds?: number[],
  incluirPruebas = false
): Promise<TimeRecord[]> => {
  const filter: any = {};

  if (storeIds && storeIds.length > 0) {
    filter.store_id = { _in: storeIds };
  }
  if (!incluirPruebas) {
    filter.store_id = { ...(filter.store_id || {}), _neq: STORE_PRUEBAS };
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
        fields: ['id', 'record_date', 'record_time', 'original_record_time', 'log_type', 'employee_id.document_number', 'employee_id.first_name', 'employee_id.middle_name', 'employee_id.last_name', 'employee_id.second_last_name', 'store_id.id', 'store_id.name', 'observations'],
        filter,
        sort: ['record_date'],
        limit: -1,
      })
    )
  ) as TimeRecord[];
};

export const fetchNewnessReportsExport = async (
  fechaInicio?: string,
  fechaFin?: string,
  storeIds?: number[],
  incluirPruebas = false
): Promise<NewnessReport[]> => {
  const filter: any = { _and: [] };

  if (storeIds && storeIds.length > 0) {
    filter._and.push({ store_id: { _in: storeIds } });
  }
  if (!incluirPruebas) {
    filter._and.push({ store_id: { _neq: STORE_PRUEBAS } });
  }

  if (fechaInicio || fechaFin) {
    const reportRange: any = {};
    const createdRange: any = {};
    if (fechaInicio) {
      reportRange._gte = fechaInicio;
      createdRange._gte = `${fechaInicio}T00:00:00`;
    }
    if (fechaFin) {
      reportRange._lte = fechaFin;
      createdRange._lte = `${fechaFin}T23:59:59`;
    }
    filter._and.push({
      _or: [
        { report_date: reportRange },
        { _and: [{ report_date: { _null: true } }, { date_created: createdRange }] },
      ],
    });
  }

  if (filter._and.length === 0) delete filter._and;

  return await withAutoRefresh(() =>
    directus.request(
      readItems('com_newness_reports', {
        fields: [
          'id',
          'report_date',
          'date_created',
          'observations',
          'newness_id.name',
          'store_id',
          'employee_id.id',
          'employee_id.document_number',
          'employee_id.first_name',
          'employee_id.middle_name',
          'employee_id.last_name',
          'employee_id.second_last_name',
        ],
        filter,
        sort: ['report_date'],
        limit: -1,
      })
    )
  ) as NewnessReport[];
};

export interface EventReportExport {
  event_type: string;
  date: string | null;
  hour: string | null;
  observations: string | null;
  store_id: string | number | null;
  employee_id: {
    document_number?: string | number | null;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    second_last_name: string | null;
  } | null;
}

export const fetchEventReportsExport = async (
  fechaInicio?: string,
  fechaFin?: string,
  storeIds?: number[],
  incluirPruebas = false
): Promise<EventReportExport[]> => {
  const filter: any = {};
  if (storeIds && storeIds.length > 0) filter.store_id = { _in: storeIds };
  if (!incluirPruebas) filter.store_id = { ...(filter.store_id || {}), _neq: STORE_PRUEBAS };
  if (fechaInicio) filter.date = { ...filter.date, _gte: fechaInicio };
  if (fechaFin) filter.date = { ...filter.date, _lte: fechaFin };

  return await withAutoRefresh(() =>
    directus.request(
      readItems('com_event_reports', {
        fields: [
          'event_type',
          'date',
          'hour',
          'observations',
          'store_id',
          'employee_id.document_number',
          'employee_id.first_name',
          'employee_id.middle_name',
          'employee_id.last_name',
          'employee_id.second_last_name',
        ],
        filter,
        sort: ['date', 'hour'],
        limit: -1,
      })
    )
  ) as EventReportExport[];
};

export async function getEmployeeTimeRecords(
  employeeId: number,
  fechaInicio: string,
  fechaFin: string
): Promise<any[]> {
  try {
    return await withAutoRefresh(() =>
      directus.request(
        readItems('com_time_records', {
          fields: ['id', 'record_date', 'record_time', 'original_record_time', 'log_type'],
          filter: { employee_id: { _eq: employeeId }, record_date: { _gte: fechaInicio, _lte: fechaFin } },
          sort: ['record_date', 'record_time'],
          limit: -1,
        })
      )
    );
  } catch (error) {
    console.error('❌ Error cargando marcaciones del empleado:', error);
    return [];
  }
}

export async function getEmployeeNovedades(employeeId: number, limit = 10): Promise<any[]> {
  try {
    return await withAutoRefresh(() =>
      directus.request(
        readItems('com_newness_reports', {
          fields: ['id', 'report_date', 'date_created', 'observations', 'newness_id.name'],
          filter: { employee_id: { _eq: employeeId } },
          sort: ['-id'],
          limit,
        })
      )
    );
  } catch (error) {
    console.error('❌ Error cargando novedades del empleado:', error);
    return [];
  }
}

export async function getEmployeeEventReports(
  employeeId: number,
  fechaInicio: string,
  fechaFin: string
): Promise<any[]> {
  try {
    return await withAutoRefresh(() =>
      directus.request(
        readItems('com_event_reports', {
          fields: ['id', 'event_type', 'date', 'hour', 'observations'],
          filter: { employee_id: { _eq: employeeId }, date: { _gte: fechaInicio, _lte: fechaFin } },
          sort: ['-date', '-hour'],
          limit: -1,
        })
      )
    );
  } catch (error) {
    console.error('❌ Error cargando eventos del empleado:', error);
    return [];
  }
}

export async function getStoreEventReportsToday(
  storeId: number,
  date: string
): Promise<EventReportHoy[]> {
  try {
    return await withAutoRefresh(() =>
      directus.request(
        readItems('com_event_reports', {
          fields: ['id', 'employee_id.id', 'event_type', 'date'],
          filter: {
            store_id: { _eq: storeId },
            date: { _eq: date }
          },
          limit: -1,
        })
      )
    ) as EventReportHoy[];
  } catch (error) {
    console.error('❌ Error cargando eventos de la tienda:', error);
    return [];
  }
}

export async function getStoreEventReports(
  storeId: number | number[] | null,
  fechaInicio?: string,
  fechaFin?: string
): Promise<any[]> {
  try {
    const filter: any = {};
    if (storeId != null) {
      if (Array.isArray(storeId)) {
        filter.store_id = { _in: storeId };
      } else {
        filter.store_id = { _eq: storeId };
      }
    }
    if (fechaInicio || fechaFin) {
      filter.date = {};
      if (fechaInicio) filter.date._gte = fechaInicio;
      if (fechaFin) filter.date._lte = fechaFin;
    }
    return await withAutoRefresh(() =>
      directus.request(
        readItems('com_event_reports', {
          fields: [
            'id',
            'event_type',
            'date',
            'hour',
            'date_created',
            'observations',
            'employee_id.id',
            'employee_id.first_name',
            'employee_id.middle_name',
            'employee_id.last_name',
            'employee_id.second_last_name',
            'employee_id.document_number',
            'store_id.id',
            'store_id.name'
          ],
          filter,
          sort: ['-date', '-hour'],
          limit: -1,
        })
      )
    );
  } catch (error) {
    console.error('❌ Error al obtener reportes de eventos de la tienda:', error);
    return [];
  }
}
