import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStores, getCargos, buscarEmpleados, listarEmpleadosTienda } from '../api/directus/read';
import { crearEmpleado, actualizarEmpleado } from '../api/directus/create';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { horariosKeys } from './registro/keys';
import type { Cargo, EmpleadoAdmin } from '../interfaces/empleados';
import type { Tienda } from '../interfaces/tiendas';

export const TIPOS_DOCUMENTO: string[] = ['Cédula de Ciudadanía'];

export const useAdminEmpleados = (tiendaSel: number | null, setTiendaSel: (id: number | null) => void) => {
  const queryClient = useQueryClient();
  const { showSnackbar } = useGlobalSnackbar();

  const { data: tiendas = [], isLoading: loadingTiendas } = useQuery<Tienda[]>({
    queryKey: ['adminTiendas'],
    queryFn: getStores,
    staleTime: 30 * 60 * 1000,
  });

  const { data: cargos = [], isLoading: loadingCargos } = useQuery<Cargo[]>({
    queryKey: ['adminCargos'],
    queryFn: getCargos,
    staleTime: 30 * 60 * 1000,
  });

  const { data: empleadosTienda = [], isLoading: loadingTienda } = useQuery<EmpleadoAdmin[]>({
    queryKey: ['adminEmpleadosTienda', tiendaSel],
    queryFn: () => listarEmpleadosTienda(tiendaSel as number),
    enabled: tiendaSel != null,
    staleTime: 2 * 60 * 1000,
  });

  const [resultados, setResultados] = useState<EmpleadoAdmin[]>([]);
  const [empleado, setEmpleado] = useState<EmpleadoAdmin | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [yaBusco, setYaBusco] = useState(false);

  const buscar = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setBuscando(true);
    setYaBusco(true);
    setEmpleado(null);
    try {
      const result = await buscarEmpleados(q);
      setResultados(result);
    } catch (err: any) {
      showSnackbar(err?.message || 'Error al buscar', 'error');
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  };

  const seleccionar = (emp: EmpleadoAdmin | null) => setEmpleado(emp);

  const limpiarBusqueda = () => {
    setResultados([]);
    setEmpleado(null);
    setYaBusco(false);
  };

  const invalidarEmpleados = () => {
    queryClient.invalidateQueries({ queryKey: horariosKeys.empleados.todos });
    queryClient.invalidateQueries({ queryKey: ['adminEmpleadosTienda'] });
    queryClient.invalidateQueries({ queryKey: ['adminTodosEmpleados'] });
  };

  const crearMutation = useMutation({
    mutationFn: crearEmpleado,
    onSuccess: () => {
      invalidarEmpleados();
    },
  });

  const actualizarMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof actualizarEmpleado>[1] }) =>
      actualizarEmpleado(id, data),
    onSuccess: (_res, variables) => {
      invalidarEmpleados();
      setEmpleado((prev) => (prev ? { ...prev, ...variables.data } as EmpleadoAdmin : prev));
      setResultados((prev) => prev.map((e) => (e.id === variables.id ? { ...e, ...variables.data } as EmpleadoAdmin : e)));
      showSnackbar('Empleado actualizado correctamente', 'success');
    },
    onError: (err: any) => {
      showSnackbar(err?.message || 'Error al actualizar el empleado', 'error');
    },
  });

  return {
    tiendas,
    cargos,
    tiposDocumento: TIPOS_DOCUMENTO,
    loadingCatalogos: loadingTiendas || loadingCargos,

    tiendaSel,
    setTiendaSel,
    empleadosTienda,
    loadingTienda,

    resultados,
    empleado,
    buscando,
    yaBusco,
    buscar,
    seleccionar,
    limpiarBusqueda,

    crearEmpleado: crearMutation.mutateAsync,
    creando: crearMutation.isPending,
    actualizarEmpleado: actualizarMutation.mutateAsync,
    actualizando: actualizarMutation.isPending,
  };
};

export default useAdminEmpleados;
