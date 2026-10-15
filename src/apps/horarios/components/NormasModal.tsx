import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Checkbox, FormControlLabel, CircularProgress,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import type { Normas } from '../interfaces/normas';

const AZUL = '#004880';

// Da formato al texto plano de las normas en una columna vertical con estilos condicionales.
function renderContenido(
  content: string,
  obligatorio: boolean,
  checkboxState: Record<number, boolean>,
  onCheck: (idx: number, val: boolean) => void
) {
  // Unimos líneas partidas accidentalmente
  const rawLineas = content.split('\n').filter(l => l.trim() !== '');
  const lineas: string[] = [];
  for (let i = 0; i < rawLineas.length; i++) {
    let current = rawLineas[i];
    while (
      i < rawLineas.length - 1 &&
      (
        (!current.trim().match(/[:.?]$/) &&
        !rawLineas[i+1].trim().startsWith('☐') &&
        !rawLineas[i+1].trim().startsWith('✔') &&
        !rawLineas[i+1].trim().startsWith('*') &&
        !rawLineas[i+1].match(/^ {1,3}[A-Z]/) &&
        rawLineas[i+1].trim() !== rawLineas[i+1].trim().toUpperCase())
        || current.trim() === '✔'
        || current.trim() === '*'
        || current.trim() === '☐'
      )
    ) {
      current += ' ' + rawLineas[i+1].trim();
      i++;
    }
    lineas.push(current);
  }

  let enSeccionProhibiciones = false;
  const result: React.ReactNode[] = [];
  let bulletGroup: { text: string; icon: string; isProhibicion: boolean }[] = [];
  let bulletGroupKey = 0;

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    const items = [...bulletGroup];
    bulletGroup = [];
    const useGrid = items.length > 1;
    result.push(
      <Box key={`bg-${bulletGroupKey++}`} sx={{
        display: 'grid',
        gridTemplateColumns: useGrid ? '1fr 1fr' : '1fr',
        gap: '1px 8px',
        mb: 0.75, pl: 1
      }}>
        {items.map((item, j) => (
          <Box key={j} sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', py: '1px' }}>
            <Typography sx={{ color: item.isProhibicion ? '#A30000' : '#64748b', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.4, flexShrink: 0, minWidth: 14 }}>
              {item.icon}
            </Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.4 }}>
              {item.text}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  lineas.forEach((linea, i) => {
    let text = linea.trimEnd();

    // Checkboxes ☐
    if (text.trim().startsWith('☐')) {
      flushBullets();
      const contentText = text.replace(/^\s*☐\s*/, '');
      if (obligatorio) {
        result.push(
          <Box key={i} sx={{ p: 1, borderRadius: 2, bgcolor: checkboxState[i] ? '#eaf7ee' : '#f8fafc', border: `1px solid ${checkboxState[i] ? '#bfe6cb' : '#e2e8f0'}`, transition: 'all 0.2s', mt: 0.5, mb: 0.5 }}>
            <FormControlLabel
              sx={{ m: 0, alignItems: 'flex-start' }}
              control={
                <Checkbox
                  checked={!!checkboxState[i]}
                  onChange={(e) => onCheck(i, e.target.checked)}
                  sx={{ color: AZUL, '&.Mui-checked': { color: AZUL }, mt: -1 }}
                />
              }
              label={<Typography sx={{ fontSize: '0.85rem', color: '#0f2c4a', ml: 0.5, lineHeight: 1.4 }}>{contentText}</Typography>}
            />
          </Box>
        );
      } else {
        bulletGroup.push({ text: contentText, icon: '☐', isProhibicion: enSeccionProhibiciones });
      }
      return;
    }

    // Highlight keywords
    let renderedText: React.ReactNode = text;
    const keywords = ['FALTA GRAVE', 'obligatorio, personal e intransferible', 'tiempo real', 'obligatorio', 'único responsable', 'KAN CAN'];
    keywords.forEach(kw => {
      if (typeof renderedText === 'string' && renderedText.includes(kw)) {
        const parts = renderedText.split(kw);
        renderedText = (
          <>
            {parts[0]}
            <strong style={{ color: kw === 'FALTA GRAVE' ? '#A30000' : AZUL }}>{kw}</strong>
            {parts[1]}
          </>
        );
      }
    });

    const hasInlineSubtitle = text.indexOf(':') !== -1 && text.indexOf(':') < 50;
    const esTituloGrave = /falta|prohibi|incumplimiento|permitido/i.test(text.trim()) && (text.trim().endsWith(':') || text.trim() === text.trim().toUpperCase() || hasInlineSubtitle);
    if (esTituloGrave) enSeccionProhibiciones = true;
    else if (text.trim() === text.trim().toUpperCase() && text.trim().length > 10) enSeccionProhibiciones = false;

    const esSubtitulo = text.trim().endsWith(':') || text.trim().endsWith('?') || text.trim() === text.trim().toUpperCase() || hasInlineSubtitle;
    const esBullet = text.trim().startsWith('-') || text.trim().startsWith('•') || text.trim().startsWith('✔') || text.trim().startsWith('*') || (text.startsWith(' ') && text.trim().length > 3 && !esSubtitulo);

    if (esBullet) {
      const contenidoBullet = text.trim().replace(/^[-•✔*]\s*/, '');
      const bulletIcon = text.trim().startsWith('✔') ? '✔' : '•';
      bulletGroup.push({ text: contenidoBullet, icon: bulletIcon, isProhibicion: enSeccionProhibiciones });
      return;
    }

    // Cualquier elemento que no sea bullet: vaciar el grupo acumulado antes
    flushBullets();

    if (esTituloGrave || (text.trim() === text.trim().toUpperCase() && text.trim().length > 10)) {
      result.push(
        <Typography key={i} sx={{ fontWeight: 800, color: esTituloGrave ? '#A30000' : AZUL, fontSize: '0.88rem', letterSpacing: 0.5, mt: 1.25, mb: 0.5, borderBottom: `1px solid ${esTituloGrave ? '#ffcdd2' : '#e2e8f0'}`, paddingBottom: 0.25 }}>
          {text.trim()}
        </Typography>
      );
      return;
    }

    if (esSubtitulo) {
      const partes = text.trim().split(':');
      let main = text.trim();
      let rest = '';
      if (partes.length > 1 && partes[0].length < 50) {
        main = partes[0] + ':';
        rest = partes.slice(1).join(':');
      }
      result.push(
        <Typography key={i} sx={{ fontSize: '0.88rem', mt: 0.75, mb: 0.25, lineHeight: 1.4 }}>
          <strong style={{ color: AZUL }}>{main}</strong>
          <span style={{ color: '#334155' }}>{rest}</span>
        </Typography>
      );
      return;
    }

    result.push(
      <Typography key={i} sx={{ fontSize: '0.85rem', color: i === 0 ? AZUL : '#374151', lineHeight: 1.7, mb: 0.5, textAlign: 'justify', fontWeight: i === 0 ? 'bold' : 'normal' }}>
        {renderedText}
      </Typography>
    );
  });

  flushBullets();

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>{result}</Box>;
}

interface Props {
  open: boolean;
  normas: Normas | null;
  obligatorio: boolean;
  aceptando: boolean;
  titleOverride?: string;
  onClose: () => void;
  onAceptar: () => void;
}

export default function NormasModal({ open, normas, obligatorio, aceptando, titleOverride, onClose, onAceptar }: Props) {
  const [fixedCheckboxState, setFixedCheckboxState] = useState<boolean[]>([false, false, false, false, false]);
  const [checkboxState, setCheckboxState] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (open) {
      setFixedCheckboxState([false, false, false, false, false]);
      setCheckboxState({});
    }
  }, [open]);

  const lineas = normas?.content ? normas.content.split('\n').map(l => l.trim()).filter(Boolean) : [];
  const checkboxIndices = lineas.map((l, i) => l.startsWith('☐') ? i : -1).filter(i => i !== -1);
  const tieneChecks = checkboxIndices.length > 0;
  
  const allDynamicChecked = tieneChecks ? checkboxIndices.every(i => checkboxState[i]) : true;
  const allFixedChecked = fixedCheckboxState.every(v => v);
  const allChecked = allDynamicChecked && allFixedChecked;

  const handleCheck = (idx: number, val: boolean) => {
    setCheckboxState(prev => ({ ...prev, [idx]: val }));
  };

  const DECLARACION = [
    "He leído y comprendido la presente Política de Uso del Sistema de Registro de Jornada Laboral.",
    "Entiendo que el registro es personal, obligatorio e intransferible.",
    "Me comprometo a registrar de manera veraz y oportuna toda mi jornada laboral y las novedades correspondientes.",
    "Conozco que la empresa podrá verificar mis registros mediante los sistemas de videovigilancia y demás mecanismos de control autorizados.",
    "Entiendo que el incumplimiento de esta política podrá generar la aplicación de las medidas disciplinarias establecidas en el Reglamento Interno de Trabajo."
  ];

  return (
    <Dialog
      open={open}
      onClose={obligatorio ? undefined : onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={obligatorio}
      slotProps={{ paper: { sx: { borderRadius: 4 } } }}
    >
      <DialogTitle
        component="div"
        sx={{
          color: '#fff', py: 2.5, px: 3, display: 'flex', alignItems: 'center', gap: 1.75,
          background: 'linear-gradient(135deg, #004680 0%, #0a5aa0 100%)', // Gradiente azul corporativo original
        }}
      >
        <Box sx={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.18)' }}>
          <GavelIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box>
          <Typography component="span" variant="h6" sx={{ fontWeight: 800, display: 'block', lineHeight: 1.2 }}>
            {titleOverride || normas?.title || 'Normas de uso'}
          </Typography>
          <Typography component="span" variant="caption" sx={{ opacity: 0.9, display: 'block', mt: 0.25 }}>
            Lectura obligatoria · Versión {normas?.version ?? '—'}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 1, bgcolor: '#fbfdff' }}>

        {/* Cuerpo de las normas en una columna */}
        <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid #eef2f6' }}>
          {normas?.content
            ? renderContenido(normas.content, obligatorio, checkboxState, handleCheck)
            : <Typography sx={{ fontSize: '0.9rem', color: '#94a3b8' }}>No hay normas configuradas.</Typography>}
        </Box>

        {obligatorio && (
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontWeight: 800, color: AZUL, fontSize: '0.9rem', mb: 1 }}>DECLARACIÓN DEL COLABORADOR</Typography>
            <Typography sx={{ fontSize: '0.82rem', color: '#475569', mb: 1.5 }}>
              Al seleccionar "ACEPTO" y utilizar este sistema, declaro que:
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {DECLARACION.map((texto, idx) => (
                <Box key={idx} sx={{ p: 1, borderRadius: 2, bgcolor: fixedCheckboxState[idx] ? '#eaf7ee' : '#fff', border: `1px solid ${fixedCheckboxState[idx] ? '#bfe6cb' : '#e2e8f0'}`, transition: 'all 0.2s' }}>
                  <FormControlLabel
                    sx={{ m: 0, alignItems: 'flex-start' }}
                    control={
                      <Checkbox 
                        checked={fixedCheckboxState[idx]} 
                        onChange={(e) => {
                          const newArr = [...fixedCheckboxState];
                          newArr[idx] = e.target.checked;
                          setFixedCheckboxState(newArr);
                        }} 
                        sx={{ color: AZUL, '&.Mui-checked': { color: AZUL }, mt: -1 }} 
                      />
                    }
                    label={<Typography sx={{ fontSize: '0.82rem', color: '#0f2c4a', ml: 0.5, lineHeight: 1.4 }}>
                      {texto}
                    </Typography>}
                  />
                </Box>
              ))}
            </Box>
            
            <Typography sx={{ fontSize: '0.82rem', color: '#475569', mt: 1.5, fontWeight: 'bold' }}>
              Al hacer clic en "Aceptar y continuar", manifiesto mi conformidad con los términos aquí establecidos y me comprometo a su estricto cumplimiento.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {obligatorio ? (
          <Button
            onClick={onAceptar}
            variant="contained"
            disableElevation
            disabled={!allChecked || aceptando}
            startIcon={aceptando ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : undefined}
            sx={{ bgcolor: AZUL, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#003a6b' } }}
          >
            {aceptando ? 'Guardando…' : 'Aceptar y continuar'}
          </Button>
        ) : (
          <Button
            onClick={onClose}
            variant="contained"
            disableElevation
            sx={{ bgcolor: AZUL, borderRadius: 2, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#003a6b' } }}
          >
            Cerrar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
