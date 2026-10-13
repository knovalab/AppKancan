import { readItems } from "@directus/sdk";
import { withAutoRefresh } from "@/auth/services/directusInterceptor";
import directus from "@/services/directus/directus";

// LEGACY: antes vivía en api/directus/rules.ts. Hacía una request por empleado
// (N+1 en Registros). Reemplazada por getEmpleadosQueAceptaronNormas.
// Ver results/analisis/NORMAS_N_MAS_1.md.
export async function yaAceptoNormasEmpleado(employeeId: number, ruleId: number, version?: number): Promise<boolean> {
  try {
    const filter: any = {
      _and: [
        { employee_id: { _eq: employeeId } },
        {
          _or: [
            { rule_id: { _eq: ruleId } },
            ...(version != null ? [{ version: { _eq: version } }] : []),
          ]
        }
      ]
    };
    const items = await withAutoRefresh(() =>
      directus.request(
        readItems("com_rules_acceptance", {
          fields: ["id"],
          filter,
          limit: 1,
        })
      )
    );
    return (items || []).length > 0;
  } catch (error) {
    console.error("❌ Error verificando aceptación de normas del empleado:", error);
    // En caso de error (permisos, campo inexistente, etc.) asumimos que ya aceptó
    // para no mostrar el botón innecesariamente a todos los colaboradores.
    return true;
  }
}

