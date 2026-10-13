# Nuevo layout de Horarios: qué hace cada archivo

> Archivos creados en `src/apps/horarios/layouts/` y `src/apps/horarios/navigation/`.
> Diseño y motivación: `docs/ANALISIS_RUTAS_HORARIOS.md` §5.
>
> **Estado:** el código compila (`tsc` sin errores en estos archivos) y pasa Biome, pero **todavía no está conectado** a `routes.tsx`. La app sigue usando `components/HorariosLayout.tsx` y `pages/RegistrosPage.tsx` como hasta ahora.

---

## 1. Vista general

```
src/apps/horarios/
├── navigation/                      QUÉ secciones existen y CÓMO se navega
│   ├── secciones.ts                 Configuración única de secciones, roles y textos
│   ├── useSeccionActiva.ts          Lee la sección activa de la URL / navega
│   └── RequireRole.tsx              Protección de rutas por rol + redirect inicial
│
└── layouts/                         CÓMO se ve y QUIÉN guarda el estado de navegación
    ├── HorariosLayout.tsx           Layout principal (header + pestañas + página)
    ├── SubSeccionLayout.tsx         Layout de sub-pestañas (Monitoreo, Reportes)
    ├── hooks/
    │   ├── useHorariosLayout.ts     Hook del layout: junta todo en un contexto
    │   ├── useHorariosAcceso.ts     Roles y tiendas permitidas del usuario
    │   └── useTiendaSeleccionada.ts Tienda elegida, guardada en la URL
    └── components/
        ├── HorariosHeader.tsx       Encabezado (título, selector, botones)
        ├── HorariosTabs.tsx         Pestañas principales
        ├── TiendaSelector.tsx       Selector de tienda
        ├── HeaderActions.tsx        Espacio para botones propios de cada página
        └── SpinnerSeccion.tsx       Indicador de carga del contenido
```

### Cómo se conectan

```
HorariosLayout
 │  usa useHorariosLayoutState() ──┬── useHorariosAcceso()        → roles, tiendas permitidas
 │                                 ├── useSeccionActiva()          → sección/sub-sección según la URL
 │                                 ├── useTiendaSeleccionada()     → ?tienda= de la URL
 │                                 └── useIrA()                    → función para navegar
 │
 ├─ <HorariosLayoutContext.Provider>     ← todo lo anterior queda disponible con useHorariosLayout()
 │   └─ <HeaderActionsProvider>
 │       ├─ HorariosHeader ── TiendaSelector, HeaderActionsSlot, Normas, Actualizar
 │       ├─ HorariosTabs
 │       └─ <Suspense> <Outlet/> </Suspense>   ← página activa
 │                       │
 │                       ├─ RequireRole → página (Registros, Historial, Admin…)
 │                       └─ RequireRole → SubSeccionLayout → <Outlet/> → sub-página
```

Flujo típico al hacer clic en una pestaña:

1. `HorariosTabs` llama a `irA('monitoreo')`.
2. `useIrA` navega a `/horarios/monitoreo?tienda=12` y conserva la tienda.
3. `useSeccionActiva` lee la nueva URL y devuelve la sección `monitoreo`.
4. El header cambia título, icono y subtítulo, y el selector de tienda se adapta al modo de esa sección.
5. React Router pinta la página de Monitoreo dentro del `<Outlet/>`.

---

## 2. `navigation/`

### `navigation/secciones.ts`

**Función:** es la **única fuente de verdad** de la navegación. Reemplaza los `switch (tabValue)` y los índices numéricos que hoy están repartidos en `RegistrosPage`, `MonitoreoPage` y `ReportePage`.

| Exporta | Qué es |
|---|---|
| `BASE` | Ruta base de la app: `'/horarios'` |
| `Rol` | `'tienda' \| 'admin' \| 'areaManager' \| 'report'` |
| `ModoTienda` | Cómo usa una sección el selector de tienda: `'ninguno'`, `'una'` o `'una-o-todas'` |
| `Seccion`, `SubSeccion` | Forma de cada entrada de la configuración |
| `SECCIONES` | Lista de secciones con su path, texto de pestaña, título, subtítulo, icono, roles, modo de tienda y sub-secciones |
| `INICIO_POR_ROL` | Sección a la que entra cada rol: admin y tienda → `registros`, areaManager → `monitoreo`, report → `reportes` |
| `PRIORIDAD_ROL` | Orden para elegir el rol principal si el usuario tiene varios (`admin` > `areaManager` > `tienda` > `report`) |
| `buscarSeccion(path)` | Devuelve la sección cuyo `path` coincide, o `null` |

Secciones configuradas:

| Path | Pestaña | Roles | Tienda | Notas |
|---|---|---|---|---|
| `registros` | REGISTROS | tienda, admin | una | |
| `novedades` | NOVEDADES | tienda, admin | una | |
| `historial` | HISTORIAL | tienda, admin | una-o-todas | |
| `malla` | MALLA | tienda, admin | una | `habilitada: false`, no aparece |
| `monitoreo` | MONITOREO | admin, areaManager | una-o-todas | Sub: resumen, auditoria, control-horas*, editar-registros* (*solo areaManager) |
| `reportes` | REPORTE | report, areaManager | una-o-todas | Sub: marcaciones, novedades, pausas, semanal |
| `admin` | ADMIN | admin | ninguno | `mostrarNormas: false` |

**Para agregar una sección nueva:** se añade una entrada en `SECCIONES`, su ruta en `routes.tsx` y la página. Pestañas, header, permisos y redirects la recogen solos.

### `navigation/useSeccionActiva.ts`

**Función:** traduce la URL actual a "en qué sección estoy" y ofrece una forma segura de navegar.

| Exporta | Qué hace |
|---|---|
| `useSeccionActiva()` | Usa `matchPath('/horarios/:seccion/*')` sobre `location.pathname` y devuelve `{ seccion, subseccion }` según `SECCIONES`. Si la URL no corresponde a ninguna sección, devuelve `null`. |
| `useIrA()` | Devuelve `irA(path, { replace? })`, que navega a `/horarios/<path>` **conservando los query params** (`?tienda=`, y en el futuro `?desde=`/`?hasta=`). Así cambiar de pestaña no pierde la tienda. |
| `SeccionActiva` | Tipo `{ seccion: Seccion \| null; subseccion: SubSeccion \| null }` |

Por qué existe: el router del proyecto funciona en modo declarativo (`BrowserRouter` + `useRoutes`), sin `handle` ni `useMatches`. La sección activa no se puede leer de la ruta, así que se calcula con `matchPath` contra la configuración.

### `navigation/RequireRole.tsx`

**Función:** proteger rutas por rol. El router no usa *loaders*, así que la protección se hace con componentes.

| Exporta | Qué hace |
|---|---|
| `RequireRole({ roles, children })` | Si el usuario tiene alguno de los `roles`, muestra `children`. Si no, redirige a su sección inicial (`acceso.inicio`). |
| `IndexRedirect()` | Redirige `/horarios` (y rutas desconocidas) a la sección inicial del rol. |

Se usa envolviendo el `element` de cada ruta, porque `src/router/routeValidator.ts` exige `path` o `index` en todas las rutas y no permite rutas agrupadoras sin path:

```tsx
{ path: 'admin', element: <RequireRole roles={['admin']}><AdminEmpleadosPage /></RequireRole> }
```

No necesita manejar el estado de carga: `HorariosLayout` no pinta el `<Outlet/>` hasta que los permisos están listos.

---

## 3. `layouts/hooks/`

### `layouts/hooks/useHorariosLayout.ts` (el hook del layout)

**Función:** reúne en un solo objeto todo el estado de navegación y lo comparte por contexto.

| Exporta | Qué hace |
|---|---|
| `useHorariosLayoutState()` | **Solo lo llama `HorariosLayout`.** Ejecuta `useHorariosAcceso`, `useSeccionActiva`, `useIrA` y `useTiendaSeleccionada`, calcula `seccionesVisibles` y devuelve todo memoizado. |
| `HorariosLayoutContext` | Contexto de React donde el layout publica ese estado. |
| `useHorariosLayout()` | **Lo usan las páginas y los componentes hijos.** Lee el contexto y lanza un error claro si se usa fuera de `<HorariosLayout>`. |
| `HorariosLayoutValue` | Tipo del valor expuesto. |

Valor expuesto:

```ts
{
  seccion,            // Seccion | null: sección activa
  subseccion,         // SubSeccion | null: sub-sección activa
  seccionesVisibles,  // secciones habilitadas que el usuario puede ver
  acceso,             // ver useHorariosAcceso
  tienda,             // ver useTiendaSeleccionada
  irA,                // navegar conservando ?tienda=
}
```

Ejemplo de uso en una página:

```tsx
const { tienda, acceso } = useHorariosLayout();
const { empleados } = useHorarios(tienda.storeId);
```

### `layouts/hooks/useHorariosAcceso.ts`

**Función:** calcula **una sola vez** los roles y las tiendas que puede ver el usuario. Reemplaza la lógica que hoy está repetida en unos 7 archivos (`isAreaMgr = …`, filtros `!== 5`, varios `useQuery(['adminTiendas'])`).

Cómo se calculan los roles. Se reutiliza `useHorariosPolicies` para no crear una segunda definición:

| Rol | Condición |
|---|---|
| `admin` | `esAdmin()` |
| `areaManager` | `esAreaManager() && !esAdmin()` |
| `report` | `esReport()` (el Area Manager también lo tiene) |
| `tienda` | ninguno de los anteriores |

Tiendas permitidas, con las mismas query keys que el resto de la app para compartir caché:

| Rol | `tiendasPermitidas` |
|---|---|
| admin / report | Todas (`['adminTiendas']` → `getStores`) |
| areaManager | Sus tiendas asignadas (`['tiendasAccesoUsuario']`), sin la tienda 5 |
| tienda | `[]` (no elige tienda) |

Devuelve (`HorariosAcceso`):

| Campo | Descripción |
|---|---|
| `cargando` | `true` mientras se resuelven el usuario y sus tiendas |
| `roles` | `Set` con los roles del usuario |
| `rolPrincipal` | El de mayor prioridad según `PRIORIDAD_ROL` |
| `puede(roles)` | `true` si el usuario tiene alguno de los roles indicados |
| `inicio` | Sección inicial según el rol principal |
| `puedeVerDemo` | Si puede activar el empleado demo |
| `tiendaPropia` | `store_id` del usuario (`['horariosStoreId']`) |
| `tiendasPermitidas` | Lista de `Tienda` según la tabla anterior |

> El problema de `esReport()` (se activa con cualquier política que contenga "report", sea o no de horarios) sigue presente, porque vive en `useHorariosPolicies`. Cuando se corrija allí (PR 1 del plan), este hook hereda el arreglo sin cambios.

### `layouts/hooks/useTiendaSeleccionada.ts`

**Función:** guarda la tienda elegida **en la URL** y la resuelve sin ambigüedades. Reemplaza el antiguo `storeOverride`, donde `null` significaba "mi tienda" en unas vistas y "todas" en otras.

URL:

| URL | Significado |
|---|---|
| `?tienda=12` | La tienda 12 |
| `?tienda=todas` | Todas las tiendas permitidas |
| (sin parámetro) | Valor por defecto (ver reglas) |

Reglas para decidir la selección efectiva:

1. Un usuario de **tienda** (o sin tiendas permitidas) siempre ve su propia tienda, diga lo que diga la URL.
2. Si la URL pide una tienda **permitida**, se usa.
3. Si la URL pide `todas` y la sección lo admite (`una-o-todas`), se usa.
4. Si no, por defecto se usa la tienda propia, si está permitida.
5. Si la propia no está permitida (caso Area Manager), se usa "todas" cuando la sección lo admite, o si no la primera tienda permitida.

Devuelve (`TiendaSeleccionada`):

| Campo | Descripción |
|---|---|
| `seleccion` | `{ tipo: 'propia' } \| { tipo: 'todas' } \| { tipo: 'una', id }` ya validada |
| `storeId` | Tienda concreta, o `null` solo cuando es "todas" |
| `storeIds` | Siempre una lista explícita: `[id]` o los ids de las permitidas |
| `nombre` | Nombre para el header (`''` si es "todas") |
| `setSeleccion(s)` | Escribe en la URL con `replace`, para no llenar el historial |

También exporta `PARAM_TIENDA = 'tienda'` y el tipo `TiendaSeleccion`.

---

## 4. `layouts/` (componentes de layout)

### `layouts/HorariosLayout.tsx`

**Función:** layout principal de la app y **dueño de la navegación**. Es el `element` que irá en la ruta `horarios` de `routes.tsx`.

Responsabilidades:

- Llamar a `useHorariosLayoutState()` y publicar el resultado en `HorariosLayoutContext`.
- Montar `HeaderActionsProvider`.
- Llamar a `syncTimeWithServer()` **una sola vez** para toda la app. Hoy se llama dos veces dentro de `RegistrosPage`.
- Pintar el contenedor *sticky* con `HorariosHeader` + `HorariosTabs`. Mantiene la clase `tour-sticky-header` que usa el tour.
- Mostrar `SpinnerSeccion` mientras `acceso.cargando`, y después `<Suspense>` + `<Outlet/>`.

Lo que **no** hace: no carga empleados, marcaciones ni novedades, y no muestra spinner de página completa. Cada página maneja sus propios datos y su estado de carga.

### `layouts/SubSeccionLayout.tsx`

**Función:** layout **genérico** para secciones con sub-pestañas. Monitoreo y Reportes usan el mismo componente en lugar de su propio `useState` de pestañas.

- Recibe `seccion` (`'monitoreo'` o `'reportes'`).
- Toma las sub-secciones de `SECCIONES` y las filtra con `acceso.puede(sub.roles ?? seccion.roles)`.
- Pinta las sub-pestañas (solo si hay más de una visible). Al hacer clic llama a `irA('monitoreo/auditoria')`.
- Pinta `<Suspense>` + `<Outlet/>` para la sub-página activa.

---

## 5. `layouts/components/`

### `HorariosHeader.tsx`

**Función:** encabezado de la app.

| Zona | Contenido |
|---|---|
| Izquierda | Icono, título y subtítulo de la sección activa (de `SECCIONES`) + `" - Nombre Tienda"` si aplica. Sin sección, muestra "Horarios" con un icono de reloj. El subtítulo se oculta en móvil. |
| Derecha | `TiendaSelector`, `HeaderActionsSlot` (botones de la página), botón **Normas** (salvo si `mostrarNormas: false`) y botón **Actualizar**. |

- **Normas** usa `useNormas()` y abre `NormasModal`, igual que hoy.
- **Actualizar** ejecuta `queryClient.refetchQueries({ type: 'active' })`: recarga solo lo que está en pantalla. Hoy `resetHorarios` invalida la caché de todas las apps.

### `HorariosTabs.tsx`

**Función:** pestañas principales.

- Se generan a partir de `seccionesVisibles` (habilitadas y permitidas para el rol).
- La pestaña activa sale de la URL (`seccion.path`), no de un `useState`.
- Al cambiar de pestaña llama a `irA(path)`, conservando `?tienda=`.
- Si el usuario solo tiene una sección (p. ej. "solo reporte"), no se muestran.
- Mantiene la clase `tour-tabs` y el estilo actual (pastillas azules).

### `TiendaSelector.tsx`

**Función:** `Autocomplete` para elegir tienda, conectado a `useTiendaSeleccionada`.

- Se oculta si la sección tiene `tienda: 'ninguno'` o si el usuario tiene una tienda o ninguna.
- Solo ofrece "Todas las tiendas" si la sección es `una-o-todas`. En Registros y Novedades ya no aparece.
- Al elegir la tienda propia guarda `propia` (URL sin parámetro), "Todas" guarda `?tienda=todas` y otra tienda guarda `?tienda=<id>`.
- Mantiene `data-tour="horarios-tienda-header"` para el tour.

### `HeaderActions.tsx`

**Función:** permite que **cada página ponga sus propios botones en el header** sin que el layout tenga que conocerlos. Así, por ejemplo, "Exportar" y "Total empleados" dejan de depender de `tabValue === 0`.

| Exporta | Rol |
|---|---|
| `HeaderActionsProvider` | Guarda la referencia al elemento del header donde se pintan los botones. Lo monta `HorariosLayout`. |
| `HeaderActionsSlot` | El lugar dentro de `HorariosHeader` donde aparecen. Se oculta si está vacío. |
| `HeaderActions` | Lo usa la página. Pinta sus `children` en el slot con `createPortal`. |

```tsx
// Dentro de RegistrosPage
<HeaderActions>
  <Button onClick={abrirExportar}>Exportar</Button>
  <Chip label={`Total Empleados: ${empleados.length}`} />
</HeaderActions>
```

Al salir de la página, los botones desaparecen del header automáticamente.

### `SpinnerSeccion.tsx`

**Función:** indicador de carga **del contenido**, no de la página completa. El header y las pestañas siguen visibles mientras carga. Acepta un `mensaje` opcional.

Lo usan `HorariosLayout` (mientras se cargan permisos y en el `Suspense` de las páginas) y `SubSeccionLayout`. Reemplaza el spinner de pantalla completa de `RegistrosPage`, que desmontaba las pestañas y hacía perder los filtros.

---

## 6. Qué falta para usarlo

| Pendiente | Dónde |
|---|---|
| Conectar `HorariosLayout` y las rutas en `routes.tsx`, con adaptadores para las páginas actuales | PR 3 del plan |
| Mover "Exportar", "Total", "Demo" y "Tutorial" de `RegistrosPage` a `<HeaderActions>` | PR 3 |
| Adaptar el tour para que navegue por paths en vez de índices | PR 3 |
| Dividir Monitoreo y Reportes en sub-páginas bajo `SubSeccionLayout` | PR 5 |
| Corregir `esReport` en `useHorariosPolicies` (el layout lo hereda) | PR 1 |
| Confirmar en Directus que la ruta registrada para la app es `/horarios` | Antes del PR 3 |
