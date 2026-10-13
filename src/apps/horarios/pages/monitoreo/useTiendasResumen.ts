import { useState, useEffect } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { LOG_TYPE } from '../../domain/registro';
dayjs.extend(isSameOrBefore);

import { getEmpleadosBulk, getTimeRecordsBulkRange, getNovedadesBulkRange, getStoreClosedDays } from '../../api/directus/read';
import { Tienda } from '../../interfaces/horarios.interface';
import { TiendaResumen } from './MonitoreoUtils';

export function useTiendasResumen(tiendas: Tienda[], fechas: { inicio: Dayjs | null; fin: Dayjs | null }) {
  const [resumen, setResumen] = useState<TiendaResumen[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaInicioStr = fechas.inicio ? fechas.inicio.format('YYYY-MM-DD') : '';
  const fechaFinStr = fechas.fin ? fechas.fin.format('YYYY-MM-DD') : '';
  const tiendasIdsStr = tiendas.map(t => t.id).join(',');

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      if (!tiendas.length) { setResumen([]); return; }
      setLoading(true); setError(null);
      const inicio = fechaInicioStr || dayjs().startOf('month').format('YYYY-MM-DD');
      const fin = fechaFinStr || dayjs().format('YYYY-MM-DD');
      try {
        const storeIds = tiendas.map(t => t.id);
        const [empleados, records, novedades, diasCerrados] = await Promise.all([
          getEmpleadosBulk(storeIds), getTimeRecordsBulkRange(storeIds, inicio, fin), getNovedadesBulkRange(storeIds, inicio, fin), getStoreClosedDays(storeIds, inicio, fin)
        ]);
        if (cancelado) return;
        const empPorTienda: Record<number, any[]> = {};
        empleados.forEach((e: any) => { if (e.storeId != null) (empPorTienda[e.storeId] ||= []).push(e); });
        const recPorTienda: Record<number, any[]> = {};
        records.forEach((r: any) => {
          const sId = r.store_id ? Number(typeof r.store_id === 'object' ? r.store_id.id : r.store_id) : null;
          if (sId != null) (recPorTienda[sId] ||= []).push(r);
        });
        const novPorTienda: Record<number, any[]> = {};
        novedades.forEach((n: any) => {
          const sId = n.store_id ? Number(typeof n.store_id === 'object' ? n.store_id.id : n.store_id) : null;
          if (sId != null) (novPorTienda[sId] ||= []).push(n);
        });
        const cerradosPorTienda: Record<number, Set<string>> = {};
        diasCerrados.forEach((c: any) => {
          const sId = c.store_id ? Number(typeof c.store_id === 'object' ? c.store_id.id : c.store_id) : null;
          if (sId != null) (cerradosPorTienda[sId] ||= new Set()).add(c.date);
        });

        const dias: string[] = [];
        let cursor = dayjs(inicio);
        while (cursor.isSameOrBefore(dayjs(fin), 'day')) { dias.push(cursor.format('YYYY-MM-DD')); cursor = cursor.add(1, 'day'); }
        const hoy = dayjs().startOf('day');

        const data = tiendas.map(tienda => {
          const emp = empPorTienda[tienda.id] || [];
          const rec = recPorTienda[tienda.id] || [];
          const nov = novPorTienda[tienda.id] || [];

          const totalEmpleados = emp.length;
          const employeeIds = new Set<number>();
          emp.forEach(e => employeeIds.add(Number(e.id)));
          rec.forEach(r => { const id = r.employee_id?.id || r.employee_id; if (id) employeeIds.add(Number(id)); });
          nov.forEach(n => { const id = n.employee_id?.id || n.employee_id; if (id) employeeIds.add(Number(id)); });
          const personasRegistradas = employeeIds.size;

          const recPorDia: Record<string, any[]> = {};
          rec.forEach((r: any) => {
            const fecha = r.record_date;
            if (!recPorDia[fecha]) recPorDia[fecha] = [];
            recPorDia[fecha].push(r);
          });
          const novPorDia: Set<string> = new Set();
          nov.forEach((n: any) => { if (n.report_date) novPorDia.add(n.report_date); });

          let incompletos = 0;
          let sinRegistro = 0;
          const fechasCerradas = cerradosPorTienda[tienda.id] || new Set();

          dias.forEach(d => {
            const fecha = dayjs(d);
            const esHoy = fecha.isSame(hoy, 'day');
            const esFuturo = fecha.isAfter(hoy, 'day');

            if (esHoy || esFuturo) return;

            if (fechasCerradas.has(d)) return;

            const registrosDia = recPorDia[d] || [];

            if (registrosDia.length === 0) {
              sinRegistro++;
              return;
            }

            const empleadosConRegistro = Array.from(new Set(registrosDia.map((r: any) => Number(r.employee_id?.id || r.employee_id))));

            let hasIncomplete = false;
            let hasComplete = false;
            empleadosConRegistro.forEach(empId => {
              const empRegs = registrosDia.filter((r: any) => Number(r.employee_id?.id || r.employee_id) === empId);
              const tieneEntrada = empRegs.some((r: any) => r.log_type === LOG_TYPE.inicioJornada);
              const tieneSalida = empRegs.some((r: any) => r.log_type === LOG_TYPE.finJornada);
              if (tieneEntrada && tieneSalida) hasComplete = true;
              else hasIncomplete = true;
            });

            if (hasIncomplete) {
              incompletos++;
            } else if (hasComplete) {
            } else {
              sinRegistro++;
            }
          });

          const recordsHoy = rec.filter(r => r.record_date === fin);
          const idsHoy = new Set(recordsHoy.map((r: any) => Number(r.employee_id?.id || r.employee_id)));
          let completados = 0;
          idsHoy.forEach(id => {
            const rEmp = recordsHoy.filter((r: any) => Number(r.employee_id?.id || r.employee_id) === id);
            if (rEmp.some(r => r.log_type === LOG_TYPE.inicioJornada) && rEmp.some(r => r.log_type === LOG_TYPE.finJornada)) completados++;
          });
          return {
            id: tienda.id,
            nombre: tienda.name,
            totalEmpleados,
            personasRegistradas,
            completados,
            incompletos,
            sinRegistro
          };
        });
        setResumen(data);
      } catch (e) { if (!cancelado) { console.error(e); setError('Error al cargar los datos. Intenta nuevamente.'); } } finally { if (!cancelado) setLoading(false); }
    };
    cargar();
    return () => { cancelado = true; };
  }, [tiendasIdsStr, fechaInicioStr, fechaFinStr]);

  return { resumen, loading, error };
}
