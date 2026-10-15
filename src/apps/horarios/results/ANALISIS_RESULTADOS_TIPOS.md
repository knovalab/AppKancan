# Análisis de resultados — Centralización de tipos e interfaces (T1–T7)

> **Fecha:** 2026-10-15, sobre `setup` @ `667faf6` + cambios sin commitear (75 archivos modificados y 13 rutas nuevas).
> **Qué se analiza:** el resultado de aplicar [`TIPOS_INTERFACES.md`](TIPOS_INTERFACES.md), descrito en [`TIPOS_INTERFACES_CAMBIOS_APLICADOS.md`](TIPOS_INTERFACES_CAMBIOS_APLICADOS.md).
> **Restricción respetada:** los `any` no se tocaron (258 antes, 258 después).

---

## 0. Veredicto

**Objetivo cumplido en la parte estructural.**
- Los tipos tienen un sitio claro.
- La dependencia entre capas va en una sola dirección.
- Ya no hay nombres duplicados.
- La conversión de coordenadas está en un único lugar.
- Todo ello sin cambios visibles y con la red de seguridad en verde: `tsc`, 256 tests y el build.

**Lo que queda pendiente es "profundidad", no "estructura":**
- **los `any`** (T8, fuera de alcance por decisión);
- **las relaciones de Directus**, que se siguen resolviendo a mano en 29 sitios;
- **algunos puentes temporales:** reexportaciones y campos `@deprecated`.

| Dimensión | Estado | Nota |
|---|---|---|
| Ubicación de los tipos | 🟢 | 11 archivos por tema + `api/` + `ui/`; un README con las reglas |
| Dirección de dependencias | 🟢 | Las 5 comprobaciones del §7.2 salen vacías |
| Nombres y duplicados | 🟢 | 0 `interface` duplicadas con forma distinta |
| Seguridad del cambio | 🟢 | Mecánico, 256 tests en verde y 1 solo cambio de comportamiento menor |
| Tipado real en los bordes (Directus) | 🔴 | 258 `any` sin tocar; las relaciones siguen sin resolverse en el DTO |
| Consistencia de estilo | 🟡 | Imports de varias líneas con indentación mezclada; los archivos modificados no se formatearon |
| Probado en el navegador | ⚪ | Pendiente |

---

## 1. Objetivos del plan contra el resultado

| # | Problema (plan §2) | Estado | Evidencia |
|---|---|---|---|
| D1 | Archivo cajón `horarios.interface.ts` | ✅ Resuelto | Eliminado; 45 importadores migrados; `grep "horarios\.interface"` → 0 |
| D2 | DTO definidos en archivos de API | ✅ Resuelto | `TimeRecordDto`, `EventReport*Dto`, `NewnessReportDto`, `StoreClosedDayDto` en `interfaces/api/`; `Normas` en `interfaces/normas.ts`; ningún componente importa tipos de `api/` |
| D3 | Tipos en línea en la API | ✅ Resuelto | Los 7 parámetros de función tienen nombre (`Create…Dto` / `Update…Dto`). El "17" del plan incluía objetos `filter`, que no son tipos |
| D4 | Ubicación de 4 formas | 🟡 Parcial | **Lectura y escritura unificadas** (`aPunto`, `coordenadasDe`: 1 solo `[lon, lat]`). **Las formas de los datos siguen siendo 3:** `VerificationData`, `LocationCoordinates` y `location` + `latitude` + `longitude` |
| D5 | Ciclo `domain` ↔ `interfaces` | ✅ Resuelto | `domain/` no importa nada de fuera |
| D6 | Mismo nombre, formas distintas | ✅ Resuelto | `TiendaOpcion`, `FilaEmpleadoDetalle`, `FilaEmpleadoPlanilla`, `PuntoGeo` |
| D7 | Festivos duplicados entre apps | 🟡 Parcial | `MapaFestivos` único y `ModalCierreMasivo` usa `useHolidays`. **Sigue la dependencia de un hook de `reservas`** |
| D8 | Relaciones sin resolver | 🔴 Casi pendiente | `Relacion<T>` existe pero solo se aplica en `EventReportHoyDto`. Quedan **29** resoluciones manuales `employee_id?.id \|\| employee_id` y 6 `idRelacion()` |
| D9 | Utils que importan UI | ✅ Resuelto | Funciones movidas a `utils/horasTrabajadas.ts` |
| D10 | `any` | ⏸️ Fuera de alcance | 258, por decisión |

**Cobertura:** 6 resueltos, 2 parciales, 1 casi pendiente y 1 fuera de alcance.

---

## 2. Métricas antes y después

| Métrica | Antes | Después | Δ |
|---|---|---|---|
| Declaraciones `interface`/`type` (sin legacy ni tests) | 174 | 180 | +6: DTO de entrada nombrados, `PuntoGeo`, `Coordenadas`, `TiendaOpcion`, `MapaFestivos`… |
| Archivos en `interfaces/` | 5 | 17 (+ README) | Por tema |
| Tipos en el archivo cajón | 15 | 0 | −15 |
| Imports `domain → fuera de domain` | 4 | 0 | −4 |
| Imports `utils/hooks/api → UI` | 2 | 0 | −2 |
| Sitios con `coordinates[…]` | 7 | 1 | −6 |
| `interface` duplicadas (sin contar privadas) | 3 | 0 | −3 |
| `any` | 258 | 258 | 0 |
| Tests | — (no se midió antes de empezar) | 256 | Incluye 5 nuevos de `domain/ubicacion` |
| Líneas (diff de archivos modificados) | — | +248 / −662 | Neto −414 en los modificados; el código nuevo está en los 13 archivos nuevos |

---

## 3. Cómo quedó el mapa (cuántos archivos importan cada uno)

| Archivo | Importadores | Lectura |
|---|---|---|
| `interfaces/tiendas.ts` | **24** | Es el contrato más transversal (`Tienda` aparece en layout, selector, Monitoreo, Reportes, exportaciones y Admin). Conviene cuidarlo y no hacerlo crecer |
| `domain/registro/modelo.ts` | 15 | El modelo del registro, bien acotado |
| `interfaces/registro.ts` | 13 | Contratos de acciones + `Motivo` |
| `interfaces/comunes.ts` | 12 | `Resultado`, `MapaFestivos` |
| `interfaces/novedades.ts`, `interfaces/api/timeRecords.ts`, `domain/ubicacion.ts` | 8 c/u | |
| `interfaces/empleados.ts` | 7 | |
| `interfaces/normas.ts` | 6 | |
| `interfaces/historial.ts`, `interfaces/acceso.ts` | 5 c/u | |
| `interfaces/ui/monitoreo.ts`, `api/stores.ts`, `api/eventReports.ts` | 4 c/u | |
| `interfaces/verificacion.ts`, `api/newness.ts` | 3 c/u | |
| `interfaces/api/employees.ts`, `api/relacion.ts` | 1 c/u | `Relacion` casi sin uso (ver D8) |

No hay archivos con 0 importadores, y ninguno concentra más de 24. El reparto es sano: ningún archivo vuelve a ser un cajón.

**Exportados fuera de `interfaces/`** (comprobación 3 del §7.2): quedan 23. Todos encajan en las excepciones de la regla:

| Tipo de excepción | Ejemplos |
|---|---|
| Firma pública de un hook o un módulo | `UseInAppCameraReturn`, `CapturedPhoto`, `LocationCoordinates`, `SeccionActiva`, `HorariosLayoutValue`, `AccionesRegistro` |
| Infraestructura con un solo consumidor | `FaceBox`, `AssetTransformOptions`, `DirectusTransformOperation` |
| Configuración de UI de un módulo | `AccionCabecera`, `ModalCabecera`, `EventoMeta`, `SlotAcciones`, `TourPhase` |
| Un solo módulo consumidor | `TiendaResumen`, `SortField`, `TramoSemana`, `NovedadFormValues`, `NombreSeparado` |

---

## 4. Calidad y riesgo del cambio

### 4.1 Cómo se hizo

- **Codemod sobre los imports:** un script que solo reescribe las declaraciones `import` y renombra los identificadores afectados en los archivos que los importaban. Así se evitan errores manuales en 45+ archivos.
- **Movimientos sin cambiar el código:** `calcularMinutosDia` y `calcularMinutosSemanales` se copiaron tal cual (incluidos sus `any`) y los archivos de origen las reexportan.
- **Red de seguridad:** `tsc` estricto después de cada fase, 256 tests y el build.

### 4.2 Riesgos residuales

| Riesgo | Probabilidad | Impacto | Cómo se detecta |
|---|---|---|---|
| `coordenadasDe` lee primero los campos sueltos y después `location`. En `useHistorial` se le pasa **solo** `location`, para no cambiar el comportamiento (la consulta no pide `latitude`/`longitude`) | Baja | Mapa en un punto distinto | E1, E2 y E4 de `PRUEBAS_NAVEGADOR.md` |
| `aPunto` arma el `location` del guardado (antes era un literal en `create.ts`) | Baja (tiene test de orden) | Ubicación invertida en BD | R1: revisar el payload |
| `ModalCierreMasivo` con `useHolidays`: ante un error de red, la query falla y reintenta, cuando antes devolvía `{}` | Baja | Errores en consola sin red; el calendario se ve igual | Cierre masivo sin red |
| Reexportaciones en `ModalDetalleTiendaUtils`/`ReporteUtils` | Muy baja | — | `tsc` |
| Renombres en `legacy/` para que compile | Nula (no se ejecuta) | — | `tsc` |
| Indentación mezclada en imports reescritos | — | Ruido en el diff | Revisión |

### 4.3 Lo que no se verificó

- **Navegador:** pendiente (§7).
- **`location` en Directus:** que el campo exista sigue sin confirmar (hallazgo H1 de `PRUEBAS_NAVEGADOR.md`). No es consecuencia de esta tarea, pero `aPunto` depende de ello.

---

## 5. Deuda que queda

| # | Deuda | Tamaño | Propuesta |
|---|---|---|---|
| R1 | **`any` en los bordes** | 258 (`pages` 71, `api/directus` 56, `components/reportes` 47…) | T8 cuando se decida. Empezar por `api/directus/`, que ya tiene DTO a los que apuntar |
| R2 | **Relaciones resueltas a mano** | 29 `employee_id?.id \|\| employee_id` + 6 `idRelacion()` | Usar `Relacion<T>` en los DTO y `idRelacion()` en un solo punto (en el mapeo de la API) |
| R3 | **Tres formas de ubicación en los datos** | `VerificationData`, `LocationCoordinates`, `location`+`latitude`+`longitude` | `HistorialEventoDetalle.ubicacion: Coordenadas \| null` y, después, `VerificationData` con `Coordenadas` |
| R4 | **Campos `@deprecated`** | `TimeRecordDto.latitude/longitude` | Quitarlos cuando se migren (o se descarten) los registros antiguos (H4) |
| R5 | **Puentes de reexportación** | `ModalDetalleTiendaUtils` → `calcularMinutosDia`; `ReporteUtils` → `calcularMinutosSemanales` | Que los consumidores importen de `utils/horasTrabajadas` y borrar los puentes |
| R6 | **Rutas de import mezcladas para el modelo** | 10 imports a `domain/registro/modelo` y el resto al barrel `domain/registro` | Convención: importar siempre del barrel `domain/registro` |
| R7 | **`TipoNovedad` con `name` y `nombre`** | 4 sitios comparan ambos | Unificar en un solo campo dentro de `getTiposNovedad` |
| R8 | **Dependencia de `reservas`** | `useHolidays` y `MapaFestivos` (estructural) | Mover `useHolidays` a `src/shared/` si se acepta que es común |
| R9 | **Lint en el código movido** | `noAssignInExpressions` en `utils/horasTrabajadas.ts` | Se corrige en T8 o al tocar esa función (ya estaba así en el origen) |
| R10 | **Formato** | Imports reescritos con indentación mezclada | Pasar Biome en un commit aparte de "solo formato" |

---

## 6. Qué funcionó y qué no

**Funcionó:**
- **Hacer T4 y T7 juntas** (renombrar directamente, sin alias): ahorró una fase entera de limpieza y no deja nombres antiguos vivos.
- **Codemod + `tsc` en cada paso:** cada error aparecía en el momento, con el archivo exacto.
- **Respetar la regla de "un solo consumidor":** evitó mover tipos sin necesidad (`TiendaResumen`, `TramoSemana`…) y mantiene `interfaces/` pequeño.
- **Tests existentes como red:** los de la suite, más los 5 nuevos de ubicación (256 en total).

**No funcionó o costó más de lo previsto:**
- **Recuento del plan:** "17 tipos en línea" eran 7. El grep del análisis contaba objetos `filter`.
- **Capa de los tipos de ubicación:** el plan los ponía en `interfaces/`, pero la regla de dependencias obligó a dejarlos en `domain/`. El plan tenía una contradicción interna.
- **`legacy/` hay que mantenerlo:** al estar dentro de `src/`, se compila y obliga a migrar también sus imports.

---

## 7. Próximos pasos

1. **Probar en el navegador** lo que toca este cambio (`TIPOS_INTERFACES_CAMBIOS_APLICADOS.md` §5): R1, E1, E2, E4, O1, O2, O3, O7 y el cierre masivo.
2. **Commitear en dos partes:**
   - estructura (`interfaces/`, `domain/`, `utils/horasTrabajadas.ts`, imports);
   - documentación (`results/`).
3. **R5 + R6** (puentes y rutas de import): limpieza corta y sin riesgo.
4. **R2 + R3** (relaciones y ubicación en los datos): el siguiente salto de calidad real; prepara T8.
5. **T8** cuando se decida tocar los `any`, empezando por `api/directus/`.
6. *(Opcional)* **R8:** decidir si `useHolidays` pasa a `src/shared/`.
