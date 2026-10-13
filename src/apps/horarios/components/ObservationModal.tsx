import { X, Clock, Play, Coffee, UtensilsCrossed, LogOut, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ObservacionEvento } from '../interfaces/horarios.interface';
import { LOG_TYPE } from '../domain/registro';

interface ObservationModalProps {
  open: boolean;
  onClose: () => void;
  empleado: string;
  fecha: string;
  observaciones: ObservacionEvento[];
}

const EVENTO_META: Record<
  string,
  { orden: number; icon: typeof Play; color: string; bg: string }
> = {
  [LOG_TYPE.inicioJornada]: { orden: 0, icon: Play, color: '#16a34a', bg: '#dcfce7' },
  [LOG_TYPE.inicioAlmuerzo]: { orden: 1, icon: Coffee, color: '#ea580c', bg: '#ffedd5' },
  [LOG_TYPE.finAlmuerzo]: { orden: 2, icon: UtensilsCrossed, color: '#ca8a04', bg: '#fef9c3' },
  [LOG_TYPE.finJornada]: { orden: 3, icon: LogOut, color: '#004680', bg: '#eaf2fb' },
};

const inicial = (nombre: string) => (nombre.trim()[0] || '?').toUpperCase();

export function ObservationModal({
  open,
  onClose,
  empleado,
  fecha,
  observaciones,
}: ObservationModalProps) {
  const ordenadas = [...observaciones].sort(
    (a, b) => (EVENTO_META[a.evento]?.orden ?? 99) - (EVENTO_META[b.evento]?.orden ?? 99)
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none p-4"
          >
            <div className="pointer-events-auto w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#004680]">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-white/80" />
                  <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
                    Observaciones
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors duration-150 cursor-pointer"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              {/* Info del empleado */}
              <div className="px-5 py-3 bg-[#f6f9fd] border-b border-slate-100 flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#004680] text-white text-sm font-bold shrink-0">
                  {inicial(empleado)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0f2c4a] truncate capitalize">{empleado}</p>
                  <p className="text-xs text-slate-400">{fecha}</p>
                </div>
              </div>

              {/* Timeline de observaciones */}
              <div className="px-5 py-4 max-h-[340px] overflow-y-auto">
                {ordenadas.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Sin observaciones registradas.</p>
                ) : (
                  ordenadas.map((obs, idx) => {
                    const meta = EVENTO_META[obs.evento] ?? {
                      icon: FileText, color: '#64748b', bg: '#f1f5f9', orden: 99,
                    };
                    const Icono = meta.icon;
                    const esUltimo = idx === ordenadas.length - 1;
                    return (
                      <div key={idx} className="flex gap-3">
                        {/* Columna timeline: ícono + conector */}
                        <div className="flex flex-col items-center">
                          <div
                            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                            style={{ backgroundColor: meta.bg, color: meta.color }}
                          >
                            <Icono size={15} strokeWidth={2} />
                          </div>
                          {!esUltimo && <div className="w-px flex-1 bg-slate-200 my-1" />}
                        </div>

                        {/* Contenido */}
                        <div className={`flex-1 min-w-0 ${esUltimo ? '' : 'pb-4'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#0f2c4a] truncate">{obs.evento}</span>
                            {obs.hora && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                <Clock size={11} />
                                {obs.hora.slice(0, 5)}
                              </span>
                            )}
                          </div>
                          {obs.observacion && obs.observacion.trim() ? (
                            <p 
                              className="text-sm text-slate-600 leading-relaxed mt-0.5"
                              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            >
                              {obs.observacion}
                            </p>
                          ) : (
                            <p className="text-sm italic text-slate-300 mt-0.5">Sin observación</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}