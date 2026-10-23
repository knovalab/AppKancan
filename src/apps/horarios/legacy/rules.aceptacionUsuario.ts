import { createItem, readItems } from "@directus/sdk";
import { withAutoRefresh } from "@/auth/services/directusInterceptor";
import directus from "@/services/directus/directus";

// LEGACY: antes vivía en api/directus/rules.ts. Aceptación de normas por USUARIO
// (la cuenta logueada), pensada para el botón "Normas" del header. Ninguna pantalla
// la usaba: el header solo muestra las normas (ver results/FLUJO_ACEPTACION_NORMAS.md §3).
// Se conserva por si se decide la opción E de MEJORAS_HORARIOS.md §10.3.

// ¿El usuario ya aceptó esta versión de las normas?
// employee_id es la relación (M2O) al usuario logueado.
export async function yaAceptoNormas(userId: string, version: number): Promise<boolean> {
  try {
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("com_rules_acceptance", {
          fields: ["id"],
          filter: { _and: [{ employee_id: { _eq: userId } }, { version: { _eq: version } }] },
          limit: 1,
        })
      )
    );
    return (items || []).length > 0;
  } catch (error) {
    console.error("❌ Error verificando aceptación de normas:", error);
    // Ante error de lectura, no forzamos el modal repetidamente.
    return true;
  }
}

export async function registrarAceptacionNormas(userId: string, version: number) {
  return await withAutoRefresh(() =>
    directus.request(
      createItem("com_rules_acceptance", {
        employee_id: userId,
        version,
        // date_created lo asigna Directus automáticamente.
      })
    )
  );
}
