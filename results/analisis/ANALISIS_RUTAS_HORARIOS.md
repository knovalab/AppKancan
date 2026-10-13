# App Horarios: análisis de rutas, pestañas y estado global

> Alcance: `src/apps/horarios/routes.tsx`, `pages/RegistrosPage.tsx` (contenedor de todas las vistas), `ReportePage`, `MonitoreoPage`, `AdminEmpleadosPage`, `HistorialPage`, `DetallePlanillaPage`, el contexto del tour y `useHorariosPolicies`.
> Complementa `docs/MEJORAS_HORARIOS.md` (hook de datos y tipos).
>
> **Stack:** Vite 5 + React 18 + React Router DOM 7 en modo **declarativo** (`<BrowserRouter>` en `App.tsx` + `useRoutes` en `src/router/AppRoutes.tsx`). **No** es Next.js: no hay rutas por archivos, ni *server components*, ni *loaders*. Ver §4.

---

## 1. Estado actual

### 1.1 Rutas

`routes.tsx` declara **una sola ruta real**:

```
/horarios            → <Navigate to="registros">
/horarios/registros  → <RegistrosPage>   ← TODA la app vive aquí
/horarios/*          → <Navigate to="registros">
```

`AppRoutes.tsx` carga el archivo por `import.meta.glob('@/apps/**/routes.tsx')` y lo filtra según las apps permitidas al usuario. Dentro de horarios, las "secciones" no son rutas: son **estado local de React** (`useState`) dentro de `RegistrosPage`.

### 1.2 Mapa real de navegación (3 niveles de pestañas)

```
/horarios/registros  (RegistrosPage, 974 líneas)
│
├── tabValue: number ─────────────────────────────── Nivel 1 (pestañas)
│   ├── 0  REGISTROS   → grid de EmployeeCard        (oculta a Area Manager)
│   ├── 1  NOVEDADES   → <NovedadesTab>               (oculta a Area Manager)
│   ├── 2  HISTORIAL   → <HistorialPage>              (oculta a Area Manager)
│   ├── 3  MALLA       → placeholder, display:none    (MALLA_HORARIA_HABILITADA = false)
│   └── 4  MONITOREO   → <MonitoreoPage>              (admin o Area Manager)
│        └── subTab: number ───────────────────────── Nivel 2
│            ├── 0 Resumen de Asistencia  (+ ModalDetalleTienda, ModalCierreMasivo, ModalRankingTiendas)
│            ├── 1 Auditoría de Ediciones Manuales
│            ├── 2 Control de Horas    (solo Area Manager) → ReporteSemanalAreaManager
│            └── 3 Editar registros    (solo Area Manager) → <DetallePlanillaPage>
│
├── vistaAdmin: boolean ("admin")  → <AdminEmpleadosPage>   (admin)
│
└── vistaReporte: boolean ("reporte") → <ReportePage>       (report o Area Manager)
     └── visualizarTab: 'registros'|'novedades'|'pausas'|'semanal' ── Nivel 2
         ├── registros → <HistorialPage>      (otra vez)
         ├── novedades → <NovedadesTab>       (otra vez)
         ├── pausas    → ReportePausasTab
         └── semanal   → ReporteSemanalTab
```

### 1.3 Quién ve qué (roles)

`useHorariosPolicies` deriva los roles de los nombres de las políticas de Directus. Cada página los combina por su cuenta:

| Rol derivado | Dónde se calcula | Pestañas visibles | Vista inicial |
|---|---|---|---|
| Tienda (sin rol especial) | — | Registros, Novedades, Historial | Registros |
| Admin (`esAdmin`) | `RegistrosPage` | Registros, Novedades, Historial, Monitoreo, Admin, Reporte | Registros |
| Area Manager (`esAreaManager() && !esAdmin()`) | `RegistrosPage`, `MonitoreoPage`, `DetallePlanillaPage` | Monitoreo, Reporte | Monitoreo (`tabValue = 4`) |
| Solo reporte (`esReport() && !esAdmin() && !isAreaMgr`) | `RegistrosPage` | **ninguna** (se oculta la barra) | Reporte |

### 1.4 Estado compartido entre vistas

| Estado | Dueño | Lo consumen | Problema |
|---|---|---|---|
| `storeOverride` | `RegistrosPage` | Registros, Novedades, Historial, Monitoreo, Admin, Reporte, ExportEventos | Una sola tienda global con significados distintos por vista (ver §2.2) |
| `tabValue` + `vistaAdmin` + `vistaReporte` | `RegistrosPage` | Tabs, header, tour | Tres fuentes de verdad para "dónde estoy" |
| `subTab` | `MonitoreoPage` | — | Se pierde al cambiar de pestaña |
| `visualizarTab` | `ReportePage` | Tour del reporte | Se pierde al cambiar de pestaña |
| `modoDemo`, `demoEmpleado` | `RegistrosPage` | Grid de registros | Lógica de demo mezclada con la de producción |
| `['adminTiendas']` | **10 `useQuery`** distintos | Selector de tienda en cada vista | Opciones (`enabled`) distintas en cada sitio |
| `['tiendasAccesoUsuario']` + filtro `!== 5` | **7 sitios** | Filtrado de tiendas del Area Manager | Lógica copiada |
| `['horariosStoreId']` | `useHorarios`, `useHistorial`, `RegistrosPage` | Tienda del usuario | `enabled` distinto en cada uno |

---

## 2. Bugs y comportamientos confusos

### 2.1 Sin URL por sección
- Recargar la página (F5) siempre lleva a Registros (o a Monitoreo/Reporte según el rol). Se pierden la pestaña, la sub‑pestaña, la tienda y los filtros.
- El botón "Atrás" del navegador **sale de la app** en vez de volver a la pestaña anterior.
- No se puede compartir ni guardar un enlace a "Monitoreo → Auditoría de la tienda X".
- `/horarios/novedades` o `/horarios/historial` redirigen a `registros` sin avisar.

### 2.2 `storeOverride = null` significa cosas distintas en cada vista
El selector muestra **"Todas las tiendas"** cuando `storeOverride === null`, pero:
- **Registros / Novedades** usan `useHorarios(null)`, que hace *fallback* a la tienda del usuario. Un admin ve "Todas las tiendas" y en realidad está viendo **su propia tienda**.
- **Historial** (`HistorialPage storeIdAdmin={null}`) consulta sin filtro de tienda, es decir, **todas**.
- **Monitoreo / Reporte** usan `null` como "todas las permitidas" (para el Area Manager, el resultado de `tiendasFiltradas`).
- **AdminEmpleadosPage** al montarse ejecuta `onStoreChange(null)` (`AdminEmpleadosPage.tsx:57-61`). **Entrar a Admin borra la tienda seleccionada** en todas las demás pestañas.

### 2.3 Inicialización de tienda del Area Manager
`RegistrosPage.tsx:147` asigna `setStoreOverride(miTienda)` a todo el que no sea "solo reporte", **incluido el Area Manager**. Si su tienda propia no está entre sus `tiendasFiltradas`, el `Autocomplete` queda vacío (`find(...) ?? null`) pero los datos siguen filtrados por esa tienda. *(Por verificar con un usuario Area Manager real.)*

### 2.4 El spinner de página completa desmonta las pestañas
`RegistrosPage.tsx:371`: `if (loading && !vistaAdmin && !vistaReporte && tabValue !== 4) return <Spinner/>`.
`loading` viene de `useHorarios` (empleados + marcaciones de hoy). Si se cambia de tienda estando en **Novedades** o **Historial**, la clave de la query cambia, `isLoading` pasa a `true`, la página entera se reemplaza por el spinner y `HistorialPage` se desmonta: **se pierden sus filtros** (fechas, búsqueda, página).

### 2.5 Peticiones innecesarias
`useHorarios(storeOverride)` se ejecuta siempre en `RegistrosPage`, aunque el usuario sea Area Manager o "solo reporte" y nunca vea Registros. Se disparan 7 queries que nadie muestra. `ReportePage` además recibe `novedades` y **las ignora** (`novedades: _`, `ReportePage.tsx:39`).

### 2.6 Roles inconsistentes
- `esReport()` usa `s.includes('report')` **sin** filtrar por módulo (`useHorariosPolicies.ts:36`). Cualquier política de otra app que contenga "report" convierte al usuario en "reporte de horarios". `esAdmin` sí exige `time_log|horario`.
- "Area Manager" se define de dos formas:
  - `esAreaManager() && !esAdmin()` en `RegistrosPage`, `MonitoreoPage` y `DetallePlanillaPage`.
  - `esAreaManager()` a secas en `ExportHistorialDialog`, `ExportNovedadesDialog`, `ExportEventosDialog` y `ExportUnificadoDialog`.

  Un admin que además tenga política de área queda filtrado como Area Manager **solo dentro de los diálogos de exportación**.
- Los diálogos redefinen `esAdmin = esAdmin() || esReport()`, otro significado más.
- Los roles son funciones que se recalculan en cada llamada (`esAdmin()` aparece decenas de veces por render).

### 2.7 Tour acoplado a índices numéricos
- `HorariosTab = 0 | 1 | 2 | 3` en el contexto del tour, mientras que la UI usa `0..4 | 'admin' | 'reporte'`.
- Si el tour se inicia estando en Admin o Reporte, `tabChangeCallback` llama a `setTabValue(...)`, pero `vistaAdmin`/`vistaReporte` siguen en `true`. **El tour no cambia de vista** y apunta a elementos que no están en pantalla.
- El tour ya usa la URL (`?tour=start`): es la única parte que aprovecha el router.

### 2.8 Detalles menores
- `subtitulosTab` tiene 4 elementos; Monitoreo (`tabValue = 4`) queda **sin subtítulo** (`undefined`).
- `syncTimeWithServer()` se llama en **dos** `useEffect` (`RegistrosPage.tsx:141` y `:297`).
- `dayjs.locale('es')` a nivel de módulo en `RegistrosPage` y `DetallePlanillaPage` cambia el locale **global de todas las apps**.
- `TabPanel` tiene un caso especial `index === 4 ? 0.5 : 2` para el padding.
- La pestaña MALLA existe pero está oculta con `display: none`, y su índice sigue reservado.
- `MonitoreoPage` acepta `storeId` como arreglo (`Array.isArray`), pero su tipo es `number | null`, así que esa rama nunca se ejecuta.

### 2.9 Código muerto
- `components/NavbarHorarios.tsx`: no se importa en ninguna parte. Navega a rutas que no existen (`novedades`, `historial`, `malla-horaria`) y tiene botones sin acción.
- ~~`components/tour/MonitoreoTour.tsx`: el proveedor existe pero nadie lo monta.~~ **Corrección:** sí se usa; lo importa `components/reportes/ReporteSemanalAreaManager.tsx` (tour de "Control de Horas").
- `HorariosLayout`: solo envuelve un `<Outlet/>` con un `Box`; el header real está dentro de `RegistrosPage`.

---

## 3. Confusión de nombres (página vs. pestaña vs. modal)

| Archivo | Nombre sugiere | Lo que realmente es |
|---|---|---|
| `pages/RegistrosPage.tsx` | Página de registros | **Shell de toda la app**: header, tabs, roles, selector de tienda, demo, tour, normas |
| `pages/HistorialPage.tsx` | Página | Pestaña reutilizada en *Historial* y en *Reporte → registros* |
| `pages/MonitoreoPage.tsx` (exporta `MonitoreoGeneralPage`) | Página | Pestaña con 4 sub‑pestañas y 3 modales |
| `pages/DetallePlanillaPage.tsx` | Página | Sub‑pestaña de Monitoreo ("Editar registros") |
| `pages/AdminEmpleadosPage.tsx` | Página | Vista activada por un booleano, no por una ruta |
| `pages/ReportePage.tsx` | Página | Vista con 4 sub‑pestañas propias |
| `components/NovedadesTab.tsx` | Componente | Pestaña reutilizada en *Novedades* y en *Reporte → novedades* |
| `pages/reporte/ReportePausasTab.tsx` | Pestaña | Pestaña (correcto) |

Además hay **dos conceptos distintos con el mismo nombre**:
- "Registros" = pestaña 0 (marcar asistencia hoy) **y** sub‑pestaña de Reporte (histórico de marcaciones).
- "Historial" (pestaña 2) y "Reporte → registros" muestran **el mismo componente** con controles distintos.

---


## 4. Restricciones técnicas del router (no es Next.js)

Cómo se montan hoy las rutas de una app:

```
App.tsx            <BrowserRouter>
└─ AppRoutes.tsx   useRoutes([...])                        ← modo declarativo
   └─ "/" <Layout/> (layout global del portal)
      └─ ...modulosComplejosFiltrados                      ← import.meta.glob('@/apps/**/routes.tsx')
         └─ { path: 'horarios', element: <Suspense>{element}</Suspense>, children }
```

Qué implica para el diseño:

| Se puede usar | No se puede usar (solo en data routers / Next.js) |
|---|---|
| `<Outlet/>`, rutas anidadas con `children` | `loader`, `action`, `redirect()` |
| `useLocation`, `useNavigate`, `useSearchParams` | `lazy` como propiedad de la ruta |
| `useMatch`, `matchPath`, `<NavLink>`, `<Navigate>` | `handle` + `useMatches()` (para títulos/breadcrumbs) |
| `React.lazy` + `<Suspense>` (code splitting de Vite) | `errorElement` por ruta |
| Componentes *guard* que retornan `<Navigate>` | Rutas por archivos (`app/`, `page.tsx`, `layout.tsx`) |

Reglas adicionales del proyecto:

- **`routeValidator.ts` exige `path` o `index` en todas las rutas, incluidas las hijas.** No se pueden usar rutas *pathless* como agrupador o guard; el guard debe envolver el `element` de cada ruta.
- **`AppRoutes` solo envuelve en `<Suspense>` el `element` de primer nivel.** Las rutas hijas con `React.lazy` necesitan su propio `<Suspense>`, que va alrededor del `<Outlet/>` del layout.
- **Los títulos, iconos y permisos de cada sección no pueden ir en la ruta** (no hay `handle`). Van en un archivo de configuración, y el layout resuelve la sección activa con `matchPath` sobre `location.pathname`.
- **Precedente en el repo:** `src/apps/curvas/` ya usa `layouts/CurvasRouteLayout.tsx` con `<Tabs>` + `<Outlet/>` y `React.lazy` + `<Suspense>` por ruta hija. La propuesta sigue esa convención (`layouts/`, `pages/`), pero resuelve la pestaña activa desde una configuración en vez de `if (pathname.includes(...))` y `switch` de índices.

---

## 5. Propuesta: `HorariosLayout` como dueño de la navegación

### 5.1 Responsabilidades

El nuevo layout es el **único** componente que sabe en qué sección estás y cómo moverte entre secciones.

| El layout **sí** hace | El layout **no** hace |
|---|---|
| Resolver la sección y sub‑sección activas desde la URL | Pedir empleados, marcaciones, novedades, etc. |
| Pintar header (icono, título, subtítulo, nombre de tienda) | Saber qué hay dentro de cada página |
| Pintar las pestañas principales, filtradas por rol | Manejar estado propio de una página (paginación, búsquedas) |
| Pintar el selector de tienda según la sección | Mostrar un spinner de página completa por datos de una sección |
| Exponer un *slot* para acciones de cada página (Exportar, Total empleados) | |
| Botones globales: Normas, Demo, Tutorial, Actualizar | |
| Montar providers: acceso/roles, tour, `syncTimeWithServer` (una vez) | |
| `<Suspense>` + `<Outlet/>` para la página activa | |

`RegistrosPage` deja de ser el *shell* y queda solo con el grid de empleados.

### 5.2 Árbol de componentes

```
<HorariosLayout>                              layouts/HorariosLayout.tsx
├── <HorariosAccessProvider>                  roles + tiendas permitidas (una sola vez)
│   └── <HorariosTourProvider>                tour navega por paths
│       └── <HeaderActionsProvider>           slot para acciones por página
│           ├── <HorariosHeader>              sticky
│           │   ├── icono + título + subtítulo      ← desde SECCIONES[activa]
│           │   ├── <TiendaSelector>                ← según seccion.tienda
│           │   ├── <HeaderActionsSlot/>            ← lo que la página activa inyecte
│           │   └── Normas · Demo · Tutorial · Actualizar
│           ├── <HorariosTabs>                pestañas principales (por rol)
│           └── <Suspense fallback={<SpinnerSeccion/>}>
│               └── <Outlet/>                 página activa
│                   │
│                   ├── RegistrosPage
│                   ├── NovedadesPage
│                   ├── HistorialPage
│                   ├── <SubSeccionLayout seccion="monitoreo">   layouts/SubSeccionLayout.tsx
│                   │   ├── <SubTabs>         sub‑pestañas (por rol)
│                   │   └── <Suspense><Outlet/></Suspense>
│                   ├── <SubSeccionLayout seccion="reportes"> … (mismo componente)
│                   └── AdminEmpleadosPage
```

`SubSeccionLayout` es **un solo componente genérico** para Monitoreo y Reportes. Las dos secciones dejan de tener su propio `useState` de pestañas.

### 5.3 Configuración única de navegación

```ts
// navigation/secciones.ts
import type { SvgIconComponent } from '@mui/icons-material';

export type Rol = 'tienda' | 'admin' | 'areaManager' | 'report';

/** Cómo usa la sección el selector de tienda del header. */
export type ModoTienda =
  | 'ninguno'      // no se muestra (Admin tiene su propio filtro)
  | 'una'          // exige una tienda concreta (Registros, Novedades)
  | 'una-o-todas'; // permite "Todas las permitidas" (Historial, Monitoreo, Reportes)

export interface SubSeccion {
  path: string;            // relativo a la sección: 'resumen'
  label: string;
  roles?: Rol[];           // si no se indica, hereda de la sección
}

export interface Seccion {
  path: string;            // relativo a /horarios: 'monitoreo'
  label: string;           // texto de la pestaña
  titulo: string;          // título del header
  subtitulo: string;
  icon: SvgIconComponent;
  roles: Rol[];
  tienda: ModoTienda;
  habilitada?: boolean;    // feature flag (malla); false = no hay ruta ni pestaña
  subsecciones?: SubSeccion[];
}

export const BASE = '/horarios';

export const SECCIONES: readonly Seccion[] = [
  { path: 'registros', label: 'REGISTROS', titulo: 'Panel de Asistencia', subtitulo: 'Gestiona las marcaciones de asistencia del día', icon: EventNoteIcon, roles: ['tienda', 'admin'], tienda: 'una' },
  { path: 'novedades', label: 'NOVEDADES', titulo: 'Registro de Novedades', subtitulo: 'Gestiona y revisa las incidencias de asistencia', icon: AssignmentIcon, roles: ['tienda', 'admin'], tienda: 'una' },
  { path: 'historial', label: 'HISTORIAL', titulo: 'Historial', subtitulo: 'Consulta los registros históricos de la jornada', icon: HistoryIcon, roles: ['tienda', 'admin'], tienda: 'una-o-todas' },
  { path: 'malla', label: 'MALLA', titulo: 'Malla Horaria', subtitulo: 'Planificación de turnos', icon: GridViewIcon, roles: ['tienda', 'admin'], tienda: 'una', habilitada: false },
  {
    path: 'monitoreo', label: 'MONITOREO', titulo: 'Monitoreo', subtitulo: 'Resumen y auditoría por tienda', icon: AnalyticsIcon, roles: ['admin', 'areaManager'], tienda: 'una-o-todas',
    subsecciones: [
      { path: 'resumen', label: 'Resumen de Asistencia' },
      { path: 'auditoria', label: 'Auditoría de Ediciones Manuales' },
      { path: 'control-horas', label: 'Control de Horas', roles: ['areaManager'] },
      { path: 'editar-registros', label: 'Editar registros', roles: ['areaManager'] },
    ],
  },
  {
    path: 'reportes', label: 'REPORTE', titulo: 'Reporte de Asistencia', subtitulo: 'Exporta informes y visualiza registros detallados', icon: FileDownloadIcon, roles: ['report', 'admin', 'areaManager'], tienda: 'una-o-todas',
    subsecciones: [
      { path: 'marcaciones', label: 'Marcaciones' },   // antes "registros"
      { path: 'novedades', label: 'Novedades' },
      { path: 'pausas', label: 'Pausas activas' },
      { path: 'semanal', label: 'Semanal' },
    ],
  },
  { path: 'admin', label: 'ADMIN', titulo: 'Panel Administrativo', subtitulo: 'Gestión de empleados de todas las tiendas', icon: AdminPanelSettingsIcon, roles: ['admin'], tienda: 'ninguno' },
];

/** Sección inicial por rol (redirect de /horarios y de rutas no permitidas). */
export const INICIO_POR_ROL: Record<Rol, string> = {
  tienda: 'registros',
  admin: 'registros',
  areaManager: 'monitoreo',
  report: 'reportes',
};
```

Agregar una sección o sub‑sección nueva consiste en añadir una entrada aquí, una ruta en `routes.tsx` y la página. El header, las pestañas, los permisos y el tour la recogen solos.

### 5.4 Hooks de navegación

```ts
// navigation/useSeccionActiva.ts
import { matchPath, useLocation } from 'react-router-dom';

export function useSeccionActiva() {
  const { pathname } = useLocation();
  const m = matchPath(`${BASE}/:seccion/:sub?/*`, pathname);
  const seccion = SECCIONES.find((s) => s.path === m?.params.seccion) ?? null;
  const sub = seccion?.subsecciones?.find((s) => s.path === m?.params.sub) ?? null;
  return { seccion, sub };
}

// navigation/useIrA.ts — navegar conservando ?tienda= y demás filtros compartidos
export function useIrA() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (path: string) => navigate({ pathname: `${BASE}/${path}`, search: params.toString() });
}
```

### 5.5 Componentes del layout (esqueletos)

```tsx
// layouts/HorariosLayout.tsx
export default function HorariosLayout() {
  useEffect(() => { syncTimeWithServer(); }, []);   // una sola vez para toda la app
  return (
    <HorariosAccessProvider>
      <HorariosTourProvider>
        <HeaderActionsProvider>
          <Box sx={{ minHeight: 'calc(100vh - 64px)', px: { xs: 0.5, sm: 2, md: 4 }, pt: { xs: 0.5, sm: 1 }, pb: 2 }}>
            <Paper className="tour-sticky-header" elevation={0} sx={{ position: 'sticky', top: 0, zIndex: 10, /* … */ }}>
              <HorariosHeader />
              <HorariosTabs />
            </Paper>
            <Suspense fallback={<SpinnerSeccion />}>
              <Outlet />
            </Suspense>
          </Box>
        </HeaderActionsProvider>
      </HorariosTourProvider>
    </HorariosAccessProvider>
  );
}
```

```tsx
// layouts/components/HorariosTabs.tsx
export function HorariosTabs() {
  const { puede } = useHorariosAccess();
  const { seccion } = useSeccionActiva();
  const irA = useIrA();
  const visibles = SECCIONES.filter((s) => s.habilitada !== false && puede(s.roles));
  if (visibles.length <= 1) return null;        // p. ej. "solo reporte": no hay barra

  return (
    <Tabs value={seccion?.path ?? false} onChange={(_, v: string) => irA(v)} variant="scrollable" className="tour-tabs">
      {visibles.map((s) => (
        <Tab key={s.path} value={s.path} label={s.label} icon={<s.icon />} iconPosition="start" />
      ))}
    </Tabs>
  );
}
```

```tsx
// layouts/SubSeccionLayout.tsx — genérico para Monitoreo y Reportes
export default function SubSeccionLayout({ seccion: path }: { seccion: string }) {
  const seccion = SECCIONES.find((s) => s.path === path)!;
  const { puede } = useHorariosAccess();
  const { sub } = useSeccionActiva();
  const irA = useIrA();
  const visibles = (seccion.subsecciones ?? []).filter((s) => puede(s.roles ?? seccion.roles));

  return (
    <>
      <Tabs value={sub?.path ?? false} onChange={(_, v: string) => irA(`${path}/${v}`)}>
        {visibles.map((s) => <Tab key={s.path} value={s.path} label={s.label} />)}
      </Tabs>
      <Suspense fallback={<SpinnerSeccion />}>
        <Outlet />
      </Suspense>
    </>
  );
}
```

```tsx
// layouts/components/HeaderActions.tsx — slot para que cada página ponga sus botones en el header
const Ctx = createContext<{ nodo: HTMLElement | null; setNodo: (n: HTMLElement | null) => void } | null>(null);

export function HeaderActionsProvider({ children }: PropsWithChildren) {
  const [nodo, setNodo] = useState<HTMLElement | null>(null);
  return <Ctx.Provider value={{ nodo, setNodo }}>{children}</Ctx.Provider>;
}

/** Dónde se pintan (lo usa HorariosHeader). */
export function HeaderActionsSlot() {
  const ctx = useContext(Ctx)!;
  return <Box ref={ctx.setNodo} sx={{ display: 'flex', gap: 1 }} />;
}

/** Lo usa cada página: <HeaderActions><Button>Exportar</Button></HeaderActions> */
export function HeaderActions({ children }: PropsWithChildren) {
  const ctx = useContext(Ctx);
  return ctx?.nodo ? createPortal(children, ctx.nodo) : null;
}
```

Con esto, el botón **Exportar** y el chip **Total empleados**, que hoy dependen de `tabValue === 0` dentro de `RegistrosPage`, viven dentro de la propia `RegistrosPage`. Se desmontan solos al cambiar de sección.

```tsx
// navigation/RequireRole.tsx — guard declarativo (no hay loaders)
export function RequireRole({ roles, children }: PropsWithChildren<{ roles: Rol[] }>) {
  const { puede, cargando, inicio } = useHorariosAccess();
  if (cargando) return <SpinnerSeccion />;
  return puede(roles) ? <>{children}</> : <Navigate to={`${BASE}/${inicio}`} replace />;
}

// navigation/IndexRedirect.tsx
export function IndexRedirect() {
  const { inicio, cargando } = useHorariosAccess();
  return cargando ? <SpinnerSeccion /> : <Navigate to={`${BASE}/${inicio}`} replace />;
}
```

### 5.6 `routes.tsx` final

```tsx
import { lazy, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import HorariosLayout from './layouts/HorariosLayout';
import SubSeccionLayout from './layouts/SubSeccionLayout';
import { IndexRedirect } from './navigation/IndexRedirect';
import { RequireRole } from './navigation/RequireRole';
import type { Rol } from './navigation/secciones';

const RegistrosPage = lazy(() => import('./pages/registros/RegistrosPage'));
const NovedadesPage = lazy(() => import('./pages/novedades/NovedadesPage'));
const HistorialPage = lazy(() => import('./pages/historial/HistorialPage'));
const ResumenPage = lazy(() => import('./pages/monitoreo/ResumenPage'));
const AuditoriaPage = lazy(() => import('./pages/monitoreo/AuditoriaPage'));
const ControlHorasPage = lazy(() => import('./pages/monitoreo/ControlHorasPage'));
const EditarRegistrosPage = lazy(() => import('./pages/monitoreo/EditarRegistrosPage'));
const ReporteMarcacionesPage = lazy(() => import('./pages/reportes/MarcacionesPage'));
const ReporteNovedadesPage = lazy(() => import('./pages/reportes/NovedadesPage'));
const ReportePausasPage = lazy(() => import('./pages/reportes/PausasPage'));
const ReporteSemanalPage = lazy(() => import('./pages/reportes/SemanalPage'));
const AdminEmpleadosPage = lazy(() => import('./pages/admin/AdminEmpleadosPage'));

// routeValidator exige path|index en cada ruta → el guard envuelve el element.
const conRol = (roles: Rol[], el: ReactNode) => <RequireRole roles={roles}>{el}</RequireRole>;

const rutasHorarios: RouteObject[] = [
  {
    path: 'horarios',
    element: <HorariosLayout />,
    children: [
      { index: true, element: <IndexRedirect /> },
      { path: 'registros', element: conRol(['tienda', 'admin'], <RegistrosPage />) },
      { path: 'novedades', element: conRol(['tienda', 'admin'], <NovedadesPage />) },
      { path: 'historial', element: conRol(['tienda', 'admin'], <HistorialPage />) },
      {
        path: 'monitoreo',
        element: conRol(['admin', 'areaManager'], <SubSeccionLayout seccion="monitoreo" />),
        children: [
          { index: true, element: <Navigate to="resumen" replace /> },
          { path: 'resumen', element: <ResumenPage /> },
          { path: 'auditoria', element: <AuditoriaPage /> },
          { path: 'control-horas', element: conRol(['areaManager'], <ControlHorasPage />) },
          { path: 'editar-registros', element: conRol(['areaManager'], <EditarRegistrosPage />) },
        ],
      },
      {
        path: 'reportes',
        element: conRol(['report', 'admin', 'areaManager'], <SubSeccionLayout seccion="reportes" />),
        children: [
          { index: true, element: <Navigate to="marcaciones" replace /> },
          { path: 'marcaciones', element: <ReporteMarcacionesPage /> },
          { path: 'novedades', element: <ReporteNovedadesPage /> },
          { path: 'pausas', element: <ReportePausasPage /> },
          { path: 'semanal', element: <ReporteSemanalPage /> },
        ],
      },
      { path: 'admin', element: conRol(['admin'], <AdminEmpleadosPage />) },
      { path: '*', element: <IndexRedirect /> },
    ],
  },
];

export default rutasHorarios;
```

> **Riesgo a verificar:** `AppRoutes` filtra los módulos con `path.includes(app.ruta)` sobre la ruta del archivo y monta `horarios` como hijo de `/`. Las sub‑rutas (`/horarios/monitoreo/resumen`) no cambian ese filtro. Aun así, hay que confirmar en el portal que `app.ruta` para horarios es `/horarios` y no `/horarios/registros`. Si fuera la segunda, habría que actualizar el registro de la app en Directus.

### 5.7 Acceso y tienda (soporte del layout)

**Roles, una sola vez:**

```ts
// access/HorariosAccessContext.tsx
interface HorariosAccess {
  cargando: boolean;
  roles: ReadonlySet<Rol>;
  puede: (roles: Rol[]) => boolean;
  inicio: string;                 // INICIO_POR_ROL del rol principal
  puedeVerDemo: boolean;
  tiendaPropia: number | null;    // readMe().store_id
  tiendasPermitidas: Tienda[];    // admin: todas · areaManager: asignadas (sin la 5) · tienda: la propia
}
```

- Reemplaza los 10 `useQuery(['adminTiendas'])`, los 7 filtros `!== 5` y las 3 definiciones de Area Manager (§2.6).
- Corrige `esReport` para que exija el módulo `/(time_?log|horario)/`.

**Tienda seleccionada en la URL:**

```ts
// access/useTiendaSeleccionada.ts
export type TiendaSel = { tipo: 'propia' } | { tipo: 'todas' } | { tipo: 'una'; id: number };

export function useTiendaSeleccionada(): {
  sel: TiendaSel;
  storeIds: number[];             // siempre explícito; nunca null ambiguo
  setSel: (s: TiendaSel) => void; // escribe ?tienda=12 | ?tienda=todas | (sin param)
}
```

- `TiendaSelector` lee `seccion.tienda` (`ModoTienda`) para decidir si mostrarse y si ofrecer "Todas".
- Si `?tienda=` apunta a una tienda no permitida, se corrige a `propia` con `replace`.
- Admin deja de resetear la tienda (§2.2), y al recargar se conserva la sección y la tienda (§2.1).

### 5.8 Estado de las páginas al cambiar de pestaña

Con rutas, cambiar de sección **desmonta** la página anterior. Hoy pasa lo mismo, porque `TabPanel` solo renderiza la pestaña activa, así que no hay regresión. Además:

- Los datos quedan en la caché de React Query y la vuelta es instantánea.
- Los filtros que el usuario espera conservar (rango de fechas, tienda) pasan a *query params* (`?desde=&hasta=`).
- Los filtros efímeros (búsqueda, página) se quedan en `useState`.
- Desaparece el spinner de página completa (§2.4). Cada página muestra su propio estado de carga y el layout solo muestra un `<Suspense>` mientras carga el chunk.

### 5.9 Tour

- `HorariosTab` (índices `0|1|2|3`) se reemplaza por paths: `PHASE_ROUTE = { REGISTROS: 'registros', NOVEDADES: 'novedades', HISTORIAL: 'historial' }`.
- `startTour`/`nextPhase` llaman a `irA(PHASE_ROUTE[fase])`. Desaparecen `setTabChangeCallback` y el bug de §2.7.
- `?tour=start` sigue funcionando igual.
- El tour del reporte navega a `reportes/novedades`, `reportes/pausas`, etc., en vez de llamar a `setVisualizarTab`.

### 5.10 Estructura de carpetas

Sigue la convención de `src/apps/curvas` (`layouts/`, `pages/`) y conserva `api/`, `components/`, `hooks/`, `interfaces/` y `utils/` donde están, para no mover lo que no hace falta:

```
src/apps/horarios/
├── routes.tsx
├── layouts/                           ← NUEVO: navegación
│   ├── HorariosLayout.tsx
│   ├── SubSeccionLayout.tsx
│   └── components/
│       ├── HorariosHeader.tsx
│       ├── HorariosTabs.tsx
│       ├── TiendaSelector.tsx
│       ├── HeaderActions.tsx          (provider + slot + portal)
│       └── SpinnerSeccion.tsx
├── navigation/                        ← NUEVO
│   ├── secciones.ts
│   ├── useSeccionActiva.ts
│   ├── useIrA.ts
│   ├── RequireRole.tsx
│   └── IndexRedirect.tsx
├── access/                            ← NUEVO
│   ├── HorariosAccessContext.tsx      (reemplaza useHorariosPolicies)
│   └── useTiendaSeleccionada.ts
├── pages/                             ← una carpeta por sección
│   ├── registros/RegistrosPage.tsx    (solo grid + HeaderActions: Exportar, Total)
│   ├── novedades/NovedadesPage.tsx
│   ├── historial/HistorialPage.tsx
│   ├── monitoreo/{Resumen,Auditoria,ControlHoras,EditarRegistros}Page.tsx  (+ utils actuales)
│   ├── reportes/{Marcaciones,Novedades,Pausas,Semanal}Page.tsx            (+ utils actuales)
│   └── admin/AdminEmpleadosPage.tsx
├── components/                        (sin cambios; se reubica lo de cada página con el tiempo)
├── hooks/  api/  interfaces/  utils/  (sin cambios)
└── components/tour/                   (consume paths, no índices)
```

Archivos que **desaparecen**: `components/HorariosLayout.tsx` (sustituido por `layouts/HorariosLayout.tsx`), `components/NavbarHorarios.tsx` y el `TabPanel` de `RegistrosPage` (los dos primeros están ahora en `legacy/`).

---

## 6. Antes → después

| Hoy | Propuesta |
|---|---|
| `RegistrosPage` = shell (header, tabs, selector, roles, demo, tour) | `HorariosLayout` + `HorariosHeader` + `HorariosTabs` |
| `tabValue = 0 / 1 / 2` | `/horarios/registros` · `/novedades` · `/historial` |
| `tabValue = 3` + `display: none` | `habilitada: false` en `SECCIONES` (sin ruta ni pestaña) |
| `tabValue = 4` + `subTab = 0..3` | `/horarios/monitoreo/{resumen,auditoria,control-horas,editar-registros}` |
| `vistaAdmin = true` | `/horarios/admin` |
| `vistaReporte = true` + `visualizarTab` | `/horarios/reportes/{marcaciones,novedades,pausas,semanal}` |
| `switch (tabValue)` para título, icono y subtítulo | `SECCIONES[activa]` |
| Exportar/Total con `tabValue === 0` | `<HeaderActions>` dentro de `RegistrosPage` |
| `storeOverride` (state, `null` ambiguo) | `?tienda=12` · `?tienda=todas` · (ausente = propia) |
| Spinner de página completa | `<Suspense>` del layout + carga por página |
| `isAreaMgr` calculado en 7 sitios | `useHorariosAccess().puede([...])` |
| `['adminTiendas']` ×10 | `useHorariosAccess().tiendasPermitidas` |
| Tour con `setTabChangeCallback(0..3)` | Tour con `irA('novedades')` |

---

## 7. Plan de trabajo

Cada PR deja la app funcionando, se integra a `main` por separado y tiene una prueba manual por rol, porque no hay tests automáticos. Roles para probar: **tienda**, **admin**, **area manager** y **solo reporte**.

### PR 1: Arreglos sin cambiar la navegación
- `esReport` con filtro de módulo y una única definición de Area Manager (incluidos los diálogos de exportación).
- Quitar `onStoreChange(null)` de `AdminEmpleadosPage` y el `syncTimeWithServer` duplicado.
- Mover `dayjs.locale('es')` a un único punto de arranque.
- Subtítulo de Monitoreo. Borrar `NavbarHorarios` (`MonitoreoTour` sí se usa; ver §2.9).

**Prueba:** los 4 roles ven las mismas pestañas que antes. Entrar a Admin y volver conserva la tienda.

### PR 2: Base de navegación, sin cambio visual
- Crear `navigation/secciones.ts`, `access/HorariosAccessContext.tsx`, `RequireRole` e `IndexRedirect`.
- `RegistrosPage` empieza a leer roles y tiendas del contexto, en vez de `useHorariosPolicies` y sus propios `useQuery`.

**Prueba:** igual que el PR 1. No debe cambiar nada visible.

### PR 3: Nuevo `HorariosLayout` y rutas de primer nivel (PR central)
- Crear `layouts/HorariosLayout.tsx` con `HorariosHeader`, `HorariosTabs`, `TiendaSelector`, `HeaderActions` y `<Suspense>` + `<Outlet/>`.
- Registrar las rutas `registros`, `novedades`, `historial`, `monitoreo`, `reportes` y `admin` en `routes.tsx`.
- **Las páginas actuales se montan sin moverlas.** Unos *wrappers* de pocas líneas leen la tienda del layout y la pasan con las props que ya esperan (`storeId`, `storeSel`, `storeIdAdmin`). En este PR la tienda vive en un `useState` del layout, y pasa a la URL en el PR 4.
- `RegistrosPage` se reduce al grid y mueve Exportar/Total a `<HeaderActions>`.
- Se eliminan `tabValue`, `vistaAdmin`, `vistaReporte`, `TabPanel` y el spinner de página completa.
- El tour pasa a navegar por paths.

**Prueba:**
- Cada rol aterriza en su sección inicial.
- F5 conserva la sección.
- "Atrás" vuelve a la pestaña anterior.
- Escribir a mano una URL no permitida redirige.
- El tour completo recorre Registros → Novedades → Historial.

### PR 4: Tienda en la URL
- `useTiendaSeleccionada` + `TiendaSelector` según `ModoTienda`.
- Los wrappers del PR 3 usan `storeIds` explícitos (corrige §2.2 y §2.3).
- `useHorarios` recibe siempre una tienda concreta.

**Prueba:** "Todas las tiendas" ya no aparece en Registros/Novedades. `?tienda=` se conserva al cambiar de sección y al recargar. Una tienda no permitida en la URL se corrige.

### PR 5: Sub‑secciones con `SubSeccionLayout`
- Monitoreo y Reportes pasan a rutas hijas. Se eliminan `subTab` y `visualizarTab`.
- `MonitoreoPage` y `ReportePage` se dividen en las páginas de cada sub‑ruta; sus modales se quedan con la sub‑página que los usa.
- El tour del reporte navega por paths.
- `?desde=&hasta=` para el rango de fechas compartido en Reportes.

**Prueba:** las sub‑pestañas `control-horas` y `editar-registros` solo aparecen y solo son accesibles para Area Manager. El enlace directo a `/horarios/reportes/pausas` funciona.

**Coordinación:** `MonitoreoPage` (29 commits en 3 meses) y `ReportePage` (12) son los archivos con más cambios del equipo. Conviene acordar una ventana para este PR o dividirlo en uno para Monitoreo y otro para Reportes.

### PR 6: Reubicación y limpieza
- Mover las páginas a `pages/<seccion>/` y borrar los wrappers.
- Renombrar `MonitoreoGeneralPage` y `DetallePlanillaPage` según §3.
- Mover la lógica de demo a `useDemoEmpleado`.
