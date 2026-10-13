export const formatDocumentNumber = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const PARTICULAS_MINUSCULAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'von', 'van', 'da', 'di', 'do', 'das', 'dos'
]);

export const formatNombrePropio = (str: string | undefined | null): string => {
  if (!str) return '';
  const palabras = str.trim().split(/\s+/).filter(Boolean);
  return palabras
    .map((palabra, index) => {
      const lower = palabra.toLowerCase();
      if (index > 0 && PARTICULAS_MINUSCULAS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};

/** '14:05' | '14:05:00' → '02:05 PM'. Si ya viene en 12 h o no es una hora, la devuelve igual. */
export const formatTo12Hour = (timeStr: string | null): string => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (Number.isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  return `${hoursStr}:${minutes} ${ampm}`;
};
