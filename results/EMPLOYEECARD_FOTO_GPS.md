# EmployeeCard: integración de foto + GPS (commit 8a19fc5) con los tipos del dominio

## Error de tipo
El commit `8a19fc5` (verificación con foto y GPS) llegó con `pendingEvento: string | null`.
Al mezclarlo con la Fase 1, `setGuardandoRegistro` y `onRegistrarEvento` esperan `LogType`, así que `tsc` fallaba en `EmployeeCard.tsx:313` y `:316`.

**Arreglo:** `useState<LogType | null>`. Ahora el modal solo puede quedar pendiente con una marcación del catálogo.

## Cambios en `components/EmployeeCard.tsx`
| Cambio | Motivo |
|---|---|
| `pendingEvento: LogType \| null` | Corrige el error de tipo. |
| `registrarMarcacion(tipoEvento, metadata?)` extraída | La usan los dos caminos (con y sin verificación) sin duplicar la lógica de normas ni la de `guardandoRegistro`. |
| El empleado demo (`esEmpleadoDemo`) registra sin abrir el modal | Antes del arreglo, el tour abría la cámara y el GPS y **subía una foto real a Directus** para un empleado ficticio. Para recuperar el comportamiento anterior basta con quitar el `if`. |
| `metadata?: VerificationData` | Es el mismo tipo que devuelve el modal, en vez de repetir el objeto. |
| `import { type VerificationData }` | Import de solo tipo. |
| `catch (err)` sin `any` | `instanceof yup.ValidationError` ya estrecha el tipo. |

## Hallazgos sin tocar (requieren decisión)
1. **Si el guardado falla, el modal igual se cierra y la foto queda subida.** `registrarEvento` (useHorarios) atrapa el error y no lo relanza, así que `onConfirm` del modal nunca falla. Encaja con la Fase 3 (contrato `Resultado`).
2. **"Omitir almuerzo" registra dos marcaciones sin foto ni GPS** (`handleConfirmarSinAlmuerzo`).
3. **Cuando el registro ya existe** (rama `existingRecord` en `useHorarios.registrarEvento`), la actualización ignora `metadata`, así que la nueva foto y la ubicación no se guardan.
4. **La edición manual de hora (EditHourModal) no pide verificación.** Probablemente es lo correcto, porque es una corrección.

## Verificación
- `tsc`: sin errores en `apps/horarios`.
- Biome: el archivo pasa sin avisos.
- `git status` muestra el archivo como `UU` (conflicto). No tiene marcadores, pero falta `git add` para marcarlo como resuelto.
