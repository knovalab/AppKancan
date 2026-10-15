import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/hooks/useAuth';
import { getNormasActivas } from '../api/directus/rules';
import type { Normas } from '../interfaces/normas';

export function useNormas() {
  const { user } = useAuth();
  const [manualOpen, setManualOpen] = useState(false);
  const [aceptadoLocal, setAceptadoLocal] = useState<boolean | null>(null);
  const [aceptando, setAceptando] = useState(false);

  const userId = (user?.id as string | undefined) ?? null;

  const { data: normas = null } = useQuery<Normas | null>({
    queryKey: ['normasActivas'],
    queryFn: getNormasActivas,
    staleTime: 10 * 60 * 1000,
  });

  const version = normas?.version ?? null;
  
  const storageKey = userId && version != null ? `kancan_rules_accepted_${userId}_v${version}` : null;

  useEffect(() => {
    if (storageKey) {
      const valor = localStorage.getItem(storageKey);
      setAceptadoLocal(valor === 'true');
    } else {
      setAceptadoLocal(null);
    }
  }, [storageKey]);

  const SIEMPRE_MOSTRAR_NORMAS = false;

  const yaAceptoVigente = aceptadoLocal === true;
  const debeAceptar = !!normas && !!userId && (SIEMPRE_MOSTRAR_NORMAS || !yaAceptoVigente);

  const aceptar = async () => {
    if (!storageKey) return;
    setAceptando(true);
    try {
      localStorage.setItem(storageKey, 'true');
      setAceptadoLocal(true);
    } catch (error) {
      console.error("❌ Error guardando aceptación de normas localmente:", error);
    } finally {
      setAceptando(false);
    }
  };

  return {
    normas,
    debeAceptar,
    manualOpen,
    setManualOpen,
    aceptar,
    aceptando,
  };
}

export default useNormas;
