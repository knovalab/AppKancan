import { useState, useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { cargarTokenStorage } from '@/auth/services/tokenDirectus';
import { ensureValidToken } from '@/auth/services/directusInterceptor';
import { formatNombrePropio } from '../utils/format';

export interface NombreSeparado {
  first_name: string;
  middle_name: string;
  last_name: string;
  second_last_name: string;
}

const MODELO_POR_DEFECTO = 'gemini-3.6-flash';
const API_URL = import.meta.env.VITE_VENTAS_API_URL || '/api';

function obtenerModelosIA(modelosIA: unknown): string[] {
  if (!modelosIA) return [MODELO_POR_DEFECTO];
  try {
    const parsed = typeof modelosIA === 'string' ? JSON.parse(modelosIA) : modelosIA;
    if (Array.isArray(parsed)) {
      const names = parsed
        .map((m: unknown) =>
          m && typeof m === 'object' ? (m as { name?: unknown }).name : undefined,
        )
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      if (names.length > 0) return names;
    }
  } catch {
  }
  return [MODELO_POR_DEFECTO];
}

const PROMPT = (nombre: string) => `Eres un experto en onomástica e identificación de nombres colombianos. Tu tarea es separar un nombre completo en sus 4 componentes.

Devuelve EXCLUSIVAMENTE un JSON válido (sin texto adicional, sin explicaciones, sin bloques de código) con esta forma exacta:
{"first_name":"","middle_name":"","last_name":"","second_last_name":""}

Donde:
- first_name = PRIMER nombre
- middle_name = SEGUNDO nombre (NO un apellido)
- last_name = PRIMER apellido
- second_last_name = SEGUNDO apellido

Detección de formato en Colombia:
En Colombia se digitan los nombres en dos órdenes principales:
1. Formato Estándar: [Primer Nombre] [Segundo Nombre] [Primer Apellido] [Segundo Apellido] (Ej. "Freddy Albeiro Burbano Silvia")
2. Formato Nómina/Registraduría: [Primer Apellido] [Segundo Apellido] [Primer Nombre] [Segundo Nombre] (Ej. "BURBANO SILVIA FREDDY ALBEIRO")

Analiza los tokens y determina con precisión cuáles son los NOMBRES de pila (ej. Freddy, Albeiro, Maria, Juan, Carlos) y cuáles son los APELLIDOS (ej. Burbano, Silvia, Gomez, Perez, Rodriguez, de la Cruz), independientemente de si se escribió primero el apellido o primero el nombre.

REGLAS:
- Apellidos/partículas compuestas ("de", "del", "la", "los", "san", "santa", "da", "di", "van", "von") se unen al apellido que les sigue (ej. "de la Cruz" => un solo apellido "de la Cruz").
- Formatea cada componente en Title Case (primera letra Mayúscula, resto minúsculas) y conserva en minúsculas las partículas compuestas intermedias ("de", "del", "la", "los", "y").

EJEMPLOS:
"BURBANO SILVIA FREDDY ALBEIRO" => {"first_name":"Freddy","middle_name":"Albeiro","last_name":"Burbano","second_last_name":"Silvia"}
"Freddy Albeiro Burbano Silvia" => {"first_name":"Freddy","middle_name":"Albeiro","last_name":"Burbano","second_last_name":"Silvia"}
"GOMEZ PEREZ JUAN CARLOS" => {"first_name":"Juan","middle_name":"Carlos","last_name":"Gomez","second_last_name":"Perez"}
"Jose Luis de la Cruz Romero" => {"first_name":"Jose","middle_name":"Luis","last_name":"de la Cruz","second_last_name":"Romero"}
"Maria Camila Mendes Rey" => {"first_name":"Maria","middle_name":"Camila","last_name":"Mendes","second_last_name":"Rey"}

Ahora separa este nombre: "${nombre}"`;

function parsearJSON(texto: string): NombreSeparado {
  let jsonStr = texto.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  let obj: Partial<Record<keyof NombreSeparado, string>>;
  try {
    obj = JSON.parse(jsonStr);
  } catch {
    const m = jsonStr.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('La IA no devolvió un JSON válido');
    obj = JSON.parse(m[0]);
  }
  return {
    first_name: formatNombrePropio(obj.first_name),
    middle_name: formatNombrePropio(obj.middle_name),
    last_name: formatNombrePropio(obj.last_name),
    second_last_name: formatNombrePropio(obj.second_last_name),
  };
}

export const useParseNombreIA = () => {
  const { user } = useAuth();
  const [procesando, setProcesando] = useState(false);

  const disponible = !!user?.ia_key;

  const separarNombre = useCallback(async (nombreCompleto: string): Promise<NombreSeparado> => {
    const nombre = nombreCompleto.trim().replace(/\s+/g, ' ');
    if (!nombre) throw new Error('Escribe el nombre completo');
    if (!user?.ia_key) throw new Error('No tienes una clave de IA configurada en tu cuenta');

    setProcesando(true);
    try {
      await ensureValidToken();
      const tokens = cargarTokenStorage();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokens?.access) headers['Authorization'] = `Bearer ${tokens.access}`;

      const modelos = obtenerModelosIA(user?.models_ia);
      const contents = [{ role: 'user', parts: [{ text: PROMPT(nombre) }] }];

      let ultimoError: Error | null = null;
      for (const model of modelos) {
        try {
          const resp = await fetch(`${API_URL}/ia/gemini/extraer`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model, contents }),
          });
          if (!resp.ok) {
            if (resp.status === 401) {
              await ensureValidToken();
            }
            const e = await resp.json().catch(() => ({}));
            throw new Error(e?.message || `Error de IA (${resp.status})`);
          }
          const data = await resp.json();
          return parsearJSON(data.text || '');
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          if (error.message.includes("Sesión") || error.message.includes("autenticación")) {
            throw error;
          }
          ultimoError = error;
        }
      }
      throw ultimoError || new Error('No se pudo separar el nombre con IA');
    } finally {
      setProcesando(false);
    }
  }, [user]);

  return { separarNombre, procesando, disponible };
};

export default useParseNombreIA;
