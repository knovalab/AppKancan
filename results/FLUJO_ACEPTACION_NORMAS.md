# Flujo de aceptación de normas en Horarios

> Explica **cuándo** pasa cada cosa, **dónde** se guarda y **quién** la ve. Hay poco código a propósito.
> Los cambios técnicos están en [`NORMAS_CAMBIOS_APLICADOS.md`](NORMAS_CAMBIOS_APLICADOS.md).

---

## 1. Idea general

Las "normas" son un texto que se administra en Directus: la normativa de registro de horarios. Cada vez que se publica una versión nueva, **cada colaborador de la tienda tiene que aceptarla**.

En la app hay **dos flujos distintos** que comparten el mismo modal, y es fácil confundirlos:

| | Flujo A — Normas del **usuario** (header) | Flujo B — Normas de cada **empleado** (tarjetas) |
|---|---|---|
| Quién acepta | La persona que inició sesión (la cuenta de la tienda) | Cada colaborador, desde su tarjeta en Registros |
| Dónde aparece | Botón **"Normas"** del header | Botón **"Aceptar normas"** en la tarjeta y modal al "Comenzar Jornada" |
| Dónde se guarda | `localStorage` del navegador | Directus, colección `com_rules_acceptance` |
| ¿Obligatorio? | No: es solo de consulta | Sí: el modal no se puede cerrar sin aceptar |
| Quién lo ve | Todos, en cualquier sección salvo Admin | Solo usuarios con la política **`temporal`** |

El problema de rendimiento que corregimos (100 requests) estaba **solo en el flujo B**.

---

## 2. Las piezas de datos

### 2.1 Las normas vigentes (`com_rules`)

- Es una tabla en Directus con `id`, `version`, `title`, `content` e `is_active`.
- La app toma **la fila activa con la versión más alta**. Esas son "las normas vigentes".
- Publicar normas nuevas = crear una fila con versión mayor y marcarla como activa (o activar otra).

### 2.2 Las aceptaciones (`com_rules_acceptance`)

- Cada fila significa "**el empleado X aceptó la norma Y (versión Z)**".
- Campos: `employee_id`, `rule_id`, `version` y `date_created`, que pone Directus.
- Solo se **añaden** filas, nunca se modifican ni se borran. Si sale una versión nueva, las aceptaciones antiguas siguen ahí, pero ya no cuentan.

### 2.3 Cuándo se considera que un empleado "ya aceptó"

Cuando existe una fila suya en `com_rules_acceptance` que coincide con las normas vigentes **por `rule_id` o por `version`**.

> ⚠️ El "o" es permisivo: basta con que coincida uno de los dos. Seguramente está para aceptar filas antiguas que se guardaron sin `rule_id`. Está pendiente de revisar con los datos reales.

---

## 3. Flujo A — Normas del usuario (header)

```
Usuario entra a cualquier sección de /horarios (salvo Admin)
        │
        ▼
Header muestra el botón "Normas"
        │  (clic)
        ▼
Se abre el modal en modo NO obligatorio
        │
        ▼
Lee las normas y pulsa "Cerrar"   ──►  fin (no se guarda nada)
```

**Cuándo pasa:** solo cuando el usuario pulsa "Normas". Nunca se abre solo.

**Qué se guarda:** en la práctica, **nada**. El código tiene preparado guardar la aceptación en `localStorage` con la clave `kancan_rules_accepted_<userId>_v<versión>`. Pero el modal en modo no obligatorio solo muestra el botón **"Cerrar"**, no "Aceptar", así que ese guardado nunca se ejecuta. La lógica de "debe aceptar" (`debeAceptar`) tampoco la usa nadie.

**Conclusión:** hoy el flujo A es **solo de lectura**: un acceso rápido para consultar las normas. En Directus existen funciones para registrar la aceptación del usuario (`yaAceptoNormas` y `registrarAceptacionNormas`), pero ninguna pantalla las usa.

---

## 4. Flujo B — Normas de cada empleado (Registros)

Es el flujo importante. Pasa en `/horarios/registros`.

### 4.1 Al abrir Registros

```
1. Se cargan los empleados de la tienda (useHorarios)
        │
2. Se piden las normas vigentes ─────────────► Directus: com_rules
        │                                      (1 request; se comparte con el header)
        │
3. ¿El usuario tiene la política "temporal"?
        ├── NO ─► no se consulta nada más. Ningún empleado muestra el botón.
        │
        └── SÍ ─► UNA consulta con TODOS los ids de la tienda ──► Directus: com_rules_acceptance
                        │                                        "¿quién de estos aceptó la vigente?"
                        ▼
                Respuesta: lista de los que SÍ aceptaron
                        │
4. Cada tarjeta recibe "aceptó: sí/no"
        ├── sí ─► tarjeta normal
        └── no ─► tarjeta con el botón "Aceptar normas"
```

Mientras llega la respuesta, todas las tarjetas se tratan como "sí aceptó". Así el botón no aparece un momento y desaparece luego.

### 4.2 El empleado acepta desde el botón

```
Clic en "Aceptar normas" (tarjeta)
        │
        ▼
Modal OBLIGATORIO con el nombre del empleado
  - texto de las normas (con casillas, si el texto las trae)
  - 5 casillas fijas de "Declaración del colaborador"
  - solo hay botón "ACEPTO"; se activa al marcar TODAS las casillas
  - no se cierra con Esc ni haciendo clic fuera
        │  (ACEPTO)
        ▼
Se crea una fila en com_rules_acceptance ────────► Directus (1 POST)
        │
        ├── OK    ─► se cierra el modal y el empleado pasa a "aceptó" en memoria
        │            (el botón desaparece sin volver a consultar Directus)
        │
        └── error ─► el modal sigue abierto; el error se registra en consola
```

### 4.3 El empleado inicia jornada sin haber aceptado

```
Clic en "Comenzar Jornada"
        │
        ▼
Se registra la entrada (como siempre)
        │
        ▼
¿El empleado ya aceptó? (lo sabe por la consulta de 4.1, sin pedir nada nuevo)
        ├── sí ─► nada más
        └── no ─► a los 2 segundos se abre el mismo modal obligatorio de 4.2
```

La entrada **se registra igual**: aceptar las normas no bloquea la marcación, solo la sigue.

### 4.4 La tarjeta de demo

El empleado de demostración (`99999`) **siempre** cuenta como "aceptó": nunca muestra el botón ni consulta nada.

---

## 5. Dónde se guarda cada cosa (cachés)

Hay tres "memorias", de la más duradera a la más volátil:

| Dónde | Qué guarda | Cuánto dura |
|---|---|---|
| **Directus** (`com_rules`, `com_rules_acceptance`) | Fuente de verdad: normas y aceptaciones | Permanente |
| **Caché de TanStack Query** (memoria de la pestaña) | Normas vigentes y la lista de quién aceptó, por tienda | Mientras la pestaña esté abierta (ver tabla) |
| **`localStorage`** (navegador) | Aceptación del usuario del flujo A | Permanente en ese navegador, aunque hoy nunca se escribe |

### 5.1 Detalle de la caché de TanStack Query

| Dato | Clave | Se considera "fresco" | Se comparte entre |
|---|---|---|---|
| Normas vigentes | `normasActivas` | 10 min | Header, Registros y todas las tarjetas: una sola request |
| Quién aceptó | `aceptacionNormasEmpleados` + norma + versión + ids de la tienda | 5 min | Todas las tarjetas de esa tienda |

"Fresco" significa que, mientras no pasen esos minutos, se usa lo que está en memoria **sin preguntar a Directus**. Pasado ese tiempo el dato queda "viejo" y se vuelve a pedir en la siguiente oportunidad (ver §6).

Como **los ids de la tienda forman parte de la clave**, cada tienda tiene su propia entrada en la caché. Si un admin pasa de la tienda 3 a la 7 y vuelve a la 3 antes de 5 min, la 3 sale de memoria.

---

## 6. Cuándo se vuelve a consultar Directus

| Situación | ¿Consulta "quién aceptó"? |
|---|---|
| Abrir Registros por primera vez | Sí, 1 request |
| Volver a Registros desde otra sección, **antes** de 5 min | No, usa memoria |
| Volver a Registros desde otra sección, **después** de 5 min | Sí, 1 request |
| Cambiar a la pestaña del navegador y volver | **No**: desactivado a propósito |
| Pulsar **"Actualizar"** en el header | Sí, 1 request: fuerza la recarga de todo lo que está en pantalla |
| Cambiar de tienda | Sí, 1 request, salvo que esa tienda esté en memoria y fresca |
| Entra o sale un empleado de la lista | Sí, 1 request: la lista de ids cambió |
| Un empleado acepta | **No**: se actualiza la memoria directamente |
| "Comenzar Jornada" | **No**: usa el dato que ya hay |
| Recargar la página (F5) | Sí: la caché en memoria se pierde |
| Usuario **sin** `temporal` | Nunca |

---

## 7. Casos límite que conviene conocer

1. **Dos dispositivos en la misma tienda:** si el empleado acepta en el dispositivo 1, el dispositivo 2 seguirá mostrando el botón hasta que su dato caduque (5 min y una nueva oportunidad de consulta), se pulse "Actualizar" o se recargue la página. Si acepta otra vez desde el dispositivo 2, se crea **otra fila** en `com_rules_acceptance`. Es inofensivo, pero queda duplicado.
2. **Se publica una versión nueva de las normas:** quien tenga la app abierta la verá cuando caduquen las normas en memoria (10 min) o al pulsar "Actualizar". A partir de ese momento, todos los empleados vuelven a "no aceptó" hasta que acepten la nueva.
3. **Falla la consulta a Directus:** se reintenta una vez. Si vuelve a fallar, no hay datos y todos cuentan como "aceptó": no se muestra el botón ni el modal. Es mejor no molestar que bloquear por un error de red.
4. **Falla el guardado al aceptar:** el modal sigue abierto y el empleado puede volver a intentarlo. No se marca nada en memoria.
5. **Usuario sin `temporal`:** no ve el botón ni el modal al iniciar jornada. ⚠️ **Esto cambió:** antes el modal de "Comenzar Jornada" sí podía salirle. Hay que confirmarlo con negocio.

---

## 8. Resumen en una frase

> Al abrir Registros, la app pregunta **una sola vez** a Directus qué empleados de la tienda aceptaron las normas vigentes y lo guarda **5 minutos en memoria**. Las tarjetas de los que no aceptaron muestran el botón, y también se les abre el modal al iniciar jornada. Al aceptar se guarda en Directus y se actualiza la memoria sin volver a consultar. Todo esto solo ocurre si el usuario tiene la política `temporal`.

---

## 9. Preguntas abiertas para negocio

- [ ] ¿El modal de "Comenzar Jornada" debe salir también a usuarios **sin** `temporal`? (§7.5)
- [ ] El flujo A (header) ¿debe ser solo de lectura o el usuario debería aceptar formalmente? Hoy no se guarda nada.
- [ ] ¿Se admiten aceptaciones antiguas sin `rule_id`? Define si se mantiene el "o" de §2.3.
- [ ] ¿Importan las filas duplicadas por aceptar desde dos dispositivos? (§7.1)
