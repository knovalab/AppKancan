import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Paper, Typography, TextField, InputAdornment, IconButton, Button,
  Chip, Avatar, CircularProgress, Alert, Autocomplete, Select, MenuItem,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ClearIcon from '@mui/icons-material/Clear';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import StorefrontIcon from '@mui/icons-material/Storefront';
import BadgeIcon from '@mui/icons-material/Badge';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import useAdminEmpleados from '../hooks/useAdminEmpleados';
import { AdminTour, TutorialAdminButton } from '../components/tour/AdminTour';
import { listarTodosEmpleados } from '../api/directus/read';
import DialogNuevoEmpleado from '../components/admin/DialogNuevoEmpleado';
import DialogEditarEmpleado from '../components/admin/DialogEditarEmpleado';
import DialogPerfilEmpleado from '../components/admin/DialogPerfilEmpleado';
import { formatDocumentNumber } from '../utils/format';
import type { EmpleadoAdmin } from '../interfaces/empleados';
import type { Tienda } from '../interfaces/tiendas';

const AZUL = '#004680';

const OPCION_TODAS: Tienda = { id: -1, name: 'Todas las tiendas' };

const AVATAR_COLORS = ['#0284c7', '#7c3aed', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#4f46e5', '#ca8a04', '#dc2626', '#059669', '#2563eb', '#9333ea'];
const colorAvatar = (texto: string) => {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = texto.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const nombreDe = (e: EmpleadoAdmin) =>
  [e.first_name, e.middle_name, e.last_name, e.second_last_name].filter((p) => p && p.trim()).join(' ') || 'Empleado';

interface Props {
  storeSel: number | null;
  onStoreChange: (id: number | null) => void;
}

function AdminEmpleadosPageContent({ storeSel, onStoreChange }: Props) {
  const {
    tiendas, cargos, tiposDocumento,
    tiendaSel, setTiendaSel, empleadosTienda, loadingTienda,
    empleado, seleccionar,
    crearEmpleado, creando, actualizarEmpleado, actualizando,
  } = useAdminEmpleados(storeSel, onStoreChange);

  const [query, setQuery] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [perfilEmp, setPerfilEmp] = useState<EmpleadoAdmin | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
  const [vistaTodas, setVistaTodas] = useState(true);

  useEffect(() => {
    if (storeSel !== null) {
      onStoreChange(null);
    }
  }, []);


  const { data: todosEmpleados = [], isLoading: loadingTodos } = useQuery<EmpleadoAdmin[]>({
    queryKey: ['adminTodosEmpleados'],
    queryFn: listarTodosEmpleados,
    enabled: tiendaSel === null || vistaTodas,
    staleTime: 2 * 60 * 1000,
  });

  const tiendaNombre = (id: number | null) =>
    id == null ? '—' : tiendas.find((t) => String(t.id) === String(id))?.name ?? '—';

  const cargandoLista = (tiendaSel === null || vistaTodas) ? loadingTodos : loadingTienda;
  const enBusqueda = query.trim().length > 0;

  const coincide = (e: EmpleadoAdmin) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const doc = String(e.document_number ?? '');
    if (/^\d+$/.test(q)) return doc.includes(q);
    const nombre = [e.first_name, e.middle_name, e.last_name, e.second_last_name]
      .filter((p) => p && p.trim()).join(' ').toLowerCase();
    return q.split(/\s+/).every((tok) => nombre.includes(tok));
  };

  const esActivo = (e: EmpleadoAdmin) => (e.status || '').toLowerCase() === 'activo';
  const base = (tiendaSel === null || vistaTodas)
    ? todosEmpleados.filter(coincide)
    : empleadosTienda.filter(coincide);
  const nActivos = base.filter(esActivo).length;
  const nInactivos = base.length - nActivos;
  const visibles = filtroEstado === 'todos'
    ? base
    : base.filter((e) => (filtroEstado === 'activo' ? esActivo(e) : !esActivo(e)));

  const [pagina, setPagina] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(6);
  useEffect(() => { setPagina(1); }, [query, filtroEstado, tiendaSel, vistaTodas]);
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / registrosPorPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visiblesPag = visibles.slice((paginaActual - 1) * registrosPorPagina, paginaActual * registrosPorPagina);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, color: '#0f2c4a', fontSize: '1.05rem' }}>Gestión de empleados</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: '#64748b' }}>
            Busca por nombre o documento para reactivar o cambiar de tienda, o crea un empleado nuevo.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TutorialAdminButton />
          <Button
            className="tour-nuevo-empleado"
            variant="contained" disableElevation startIcon={<PersonAddIcon />} onClick={() => setModalNuevo(true)}
            sx={{ bgcolor: AZUL, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#003a6b' } }}
          >
            Nuevo empleado
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #eef2f6' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Box className="tour-selector-tienda" sx={{ minWidth: 240, flex: { xs: '1 1 100%', md: '0 0 280px' } }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', color: '#6b7280', mb: 1 }}>
              TIENDA
            </Typography>
            <Autocomplete
              size="small"
              options={[OPCION_TODAS, ...tiendas]}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={vistaTodas ? OPCION_TODAS : (tiendas.find((t) => t.id === tiendaSel) ?? null)}
              onChange={(_, v) => {
                setFiltroEstado('todos');
                if (v?.id === -1) { setVistaTodas(true); setTiendaSel(null); }
                else { setVistaTodas(false); setTiendaSel(v ? v.id : null); }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Selecciona una tienda…"
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      startAdornment: <InputAdornment position="start"><StorefrontIcon sx={{ fontSize: 18, color: AZUL }} /></InputAdornment>,
                    },
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f1f7fe' } }}
                />
              )}
            />
          </Box>

          <Box className="tour-buscador-empleado" sx={{ flex: 1, minWidth: 260 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.5px', color: '#6b7280', mb: 1 }}>
              {(tiendaSel === null || vistaTodas) ? 'BUSCAR EMPLEADO EN TODAS LAS TIENDAS' : 'BUSCAR EMPLEADO EN LA TIENDA'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Nombre o número de documento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f1f7fe' } }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    {query && (
                      <IconButton size="small" onClick={() => setQuery('')}>
                        <ClearIcon sx={{ fontSize: 16, color: '#8a9bb5' }} />
                      </IconButton>
                    )}
                    <PersonSearchIcon sx={{ color: AZUL, fontSize: 20, ml: 0.5 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
            </Box>
          </Box>
        </Box>
      </Paper>

      {cargandoLista && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} sx={{ color: AZUL }} /></Box>
      )}

      {!cargandoLista && base.length === 0 && (
        (tiendaSel === null || vistaTodas) ? (
          enBusqueda ? (
            <Alert severity="info" sx={{ borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={() => setModalNuevo(true)}>Crear nuevo</Button>}>
              No se encontraron empleados con esa búsqueda.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>No hay empleados registrados en el sistema.</Alert>
          )
        ) : enBusqueda ? (
          <Alert severity="info" sx={{ borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={() => setModalNuevo(true)}>Crear nuevo</Button>}>
            No se encontraron empleados con esa búsqueda.
          </Alert>
        ) : (
          <Alert severity="info" sx={{ borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={() => setModalNuevo(true)}>Crear nuevo</Button>}>
            Esta tienda no tiene empleados registrados.
          </Alert>
        )
      )}

      {!cargandoLista && base.length > 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, bgcolor: '#fff', border: '1px solid #eef2f6', borderRadius: 3, p: { xs: 1.5, md: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 2.5, bgcolor: '#eaf2fb', color: AZUL, border: '1px solid #d6e6f7', flexShrink: 0 }}>
                {enBusqueda ? <PersonSearchIcon sx={{ fontSize: 22 }} /> : <StorefrontIcon sx={{ fontSize: 22 }} />}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                 <Typography sx={{ fontWeight: 700, color: '#0f2c4a', fontSize: '1.02rem', lineHeight: 1.2 }} noWrap>
                  {enBusqueda
                    ? 'Resultados de la búsqueda'
                    : (tiendaSel === null
                      ? 'Todos los empleados'
                      : <>Empleados de <Box component="span" sx={{ color: AZUL }}>{tiendaNombre(tiendaSel)}</Box></>
                    )}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#94a3b8', mt: 0.2 }}>
                  {visibles.length} {visibles.length === 1 ? 'empleado' : 'empleados'}
                  {filtroEstado !== 'todos' ? ` · ${filtroEstado === 'activo' ? 'activos' : 'inactivos'}` : ''}
                </Typography>
              </Box>
            </Box>
            <Box className="tour-contadores-estado" sx={{ display: 'flex', gap: 0.75, bgcolor: '#f4f8fd', p: 0.5, borderRadius: 2, border: '1px solid #e8eef5' }}>
              {([
                { key: 'todos', label: 'Todos', n: base.length },
                { key: 'activo', label: 'Activos', n: nActivos },
                { key: 'inactivo', label: 'Inactivos', n: nInactivos },
              ] as const).map((f) => {
                const activo = filtroEstado === f.key;
                return (
                  <Box
                    key={f.key}
                    onClick={() => setFiltroEstado(f.key)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      px: 1.25, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                      fontSize: '0.78rem', fontWeight: 700,
                      color: activo ? '#fff' : '#64748b',
                      bgcolor: activo ? AZUL : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: activo ? '#003a6b' : '#eaf2fb' },
                    }}
                  >
                    {f.label}
                    <Box component="span" sx={{
                      fontSize: '0.68rem', fontWeight: 700, px: 0.6, borderRadius: 1,
                      bgcolor: activo ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                      color: activo ? '#fff' : '#64748b',
                    }}>{f.n}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {visibles.length === 0 ? (
            <Typography sx={{ fontSize: '0.85rem', color: '#94a3b8', px: 0.5 }}>
              No hay empleados {filtroEstado === 'activo' ? 'activos' : 'inactivos'} en esta búsqueda.
            </Typography>
          ) : (
          <Box className="tour-lista-empleados" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
            {visiblesPag.map((emp) => {
              const nombre = nombreDe(emp);
              const inactivo = (emp.status || '').toLowerCase() !== 'activo';
              return (
                <Paper
                  key={emp.id}
                  elevation={0}
                  onClick={() => setPerfilEmp(emp)}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: '1px solid #e8eef5',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    opacity: inactivo ? 0.85 : 1,
                    '&:hover': { borderColor: '#b9d4f0', boxShadow: '0 6px 18px rgba(0,70,128,0.10)', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: colorAvatar(nombre), width: 42, height: 42, fontWeight: 700 }}>
                      {nombre.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, color: '#0f2c4a', textTransform: 'capitalize', lineHeight: 1.2 }} noWrap>
                        {nombre}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <BadgeIcon sx={{ fontSize: 13 }} /> {emp.document_number ? formatDocumentNumber(emp.document_number) : '—'}
                      </Typography>
                    </Box>
                    <Chip
                      label={(emp.status || '—').toUpperCase()}
                      size="small"
                      sx={{
                        height: 22, fontWeight: 700, fontSize: '0.65rem',
                        bgcolor: inactivo ? '#fee2e2' : '#dcfce7',
                        color: inactivo ? '#dc2626' : '#16a34a',
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#475569' }}>
                    <WorkOutlineIcon sx={{ fontSize: 16, color: AZUL }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{emp.position_name || 'Sin cargo'}</Typography>
                  </Box>
                  {(tiendaSel === null || vistaTodas) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#475569', mt: 0.75 }}>
                      <StorefrontIcon sx={{ fontSize: 16, color: AZUL }} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{tiendaNombre(emp.store_id)}</Typography>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
          )}

          <Box className="tour-paginacion" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, bgcolor: '#fff', border: '1px solid #eef2f6', borderRadius: 3, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Mostrando {visiblesPag.length} de {visibles.length} empleados
              </Typography>
              <Select
                value={registrosPorPagina}
                onChange={(e) => { setRegistrosPorPagina(Number(e.target.value)); setPagina(1); }}
                size="small"
                sx={{
                  bgcolor: '#f1f7fe', borderRadius: 2, fontSize: '0.75rem', minWidth: 70, height: 30,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#cbd5e1' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#004680' },
                }}
              >
                <MenuItem value={6}>6</MenuItem>
                <MenuItem value={12}>12</MenuItem>
                <MenuItem value={24}>24</MenuItem>
                <MenuItem value={48}>48</MenuItem>
              </Select>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <IconButton
                size="small"
                disabled={paginaActual === 1}
                onClick={() => setPagina((p) => p - 1)}
                sx={{ border: '1px solid #dfe4ec', borderRadius: 1.5, width: 32, height: 32 }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              {(() => {
                const paginas: (number | string)[] = [];
                if (totalPaginas <= 5) {
                  for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
                } else {
                  paginas.push(1);
                  if (paginaActual > 3) paginas.push('...');
                  for (let i = Math.max(2, paginaActual - 1); i <= Math.min(totalPaginas - 1, paginaActual + 1); i++) paginas.push(i);
                  if (paginaActual < totalPaginas - 2) paginas.push('...');
                  paginas.push(totalPaginas);
                }
                return paginas.map((num, idx) =>
                  typeof num === 'string' ? (
                    <Typography key={`dots-${idx}`} variant="caption" sx={{ color: '#94a3b8', px: 0.5 }}>...</Typography>
                  ) : (
                    <Box
                      key={num}
                      onClick={() => setPagina(num)}
                      sx={{
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 1.5, cursor: 'pointer',
                        bgcolor: paginaActual === num ? '#004680' : '#fff',
                        color: paginaActual === num ? '#fff' : '#5e6f8d',
                        border: paginaActual === num ? 'none' : '1px solid #dfe4ec',
                        fontWeight: paginaActual === num ? 700 : 500,
                        fontSize: '0.85rem', transition: 'all 0.2s',
                        '&:hover': { bgcolor: paginaActual === num ? '#004680' : '#f1f5f9' },
                      }}
                    >
                      {num}
                    </Box>
                  )
                );
              })()}
              <IconButton
                size="small"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                sx={{ border: '1px solid #dfe4ec', borderRadius: 1.5, width: 32, height: 32 }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </>
      )}

      <DialogNuevoEmpleado
        open={modalNuevo}
        onClose={() => setModalNuevo(false)}
        tiendas={tiendas}
        cargos={cargos}
        tiposDocumento={tiposDocumento}
        guardando={creando}
        onGuardar={async (data) => { await crearEmpleado(data); }}
      />

      <DialogPerfilEmpleado
        open={!!perfilEmp}
        empleado={perfilEmp}
        tiendaNombre={tiendaNombre(perfilEmp?.store_id ?? tiendaSel)}
        onClose={() => setPerfilEmp(null)}
        onEditar={() => { if (perfilEmp) seleccionar(perfilEmp); setPerfilEmp(null); }}
      />

      <DialogEditarEmpleado
        open={!!empleado}
        empleado={empleado}
        tiendas={tiendas}
        cargos={cargos}
        guardando={actualizando}
        onClose={() => seleccionar(null)}
        onGuardar={async (id, data) => { await actualizarEmpleado({ id, data }); }}
      />

    </Box>
  );
}

export default function AdminEmpleadosPage(props: Props) {
  return (
    <AdminTour>
      <AdminEmpleadosPageContent {...props} />
    </AdminTour>
  );
}


