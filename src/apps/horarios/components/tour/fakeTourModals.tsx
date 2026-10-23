import React from "react";
import { EVENTO, MAX_CARACTERES_OBSERVACION } from "../../domain/registro";
import { GenericTourModal, fakeFieldStyle, FakeCancelButton, FakePrimaryButton } from "./GenericTourModal";

export const novedadModalTargets = [
  "#tour-modal-tipo",
  "#tour-modal-fecha-desde-field",
  "#tour-modal-fecha-hasta-field",
  "#tour-modal-observaciones-field",
];

export const FakeNovedadModal: React.FC<{ open: boolean; activeField: string | null }> = ({
  open,
  activeField,
}) => {
  if (!open) return null;

  const isModalStep = novedadModalTargets.includes(activeField || "");
  const isDatesActive = activeField === "#tour-modal-fecha-desde-field";
  const isTipoActive = activeField === "#tour-modal-tipo";
  const isObsActive = activeField === "#tour-modal-observaciones-field";

  return (
    <GenericTourModal
      title="Registro de Novedad"
      dimContent={isModalStep}
      footer={
        <>
          <FakeCancelButton />
          <FakePrimaryButton />
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          id="tour-modal-tipo"
          style={fakeFieldStyle(isTipoActive, {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 56,
            padding: isTipoActive ? "0 13px" : "0 14px",
            fontSize: 16,
          })}
        >
          <span style={{ color: "#94a3b8" }}>Novedad</span>
          <svg style={{ width: 20, height: 20, fill: "#64748b" }} viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Desde el día</div>
            <div
              id="tour-modal-fecha-desde-field"
              style={fakeFieldStyle(isDatesActive, {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 56,
                padding: isDatesActive ? "0 13px" : "0 14px",
                fontSize: 16,
              })}
            >
              <span style={{ color: "#1e293b" }}>15/07/2026</span>
              <svg style={{ width: 18, height: 18, fill: "#64748b" }} viewBox="0 0 24 24">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v16c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H5V8h14v13z" />
              </svg>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Hasta el día</div>
            <div
              id="tour-modal-fecha-hasta-field"
              style={fakeFieldStyle(isDatesActive || activeField === "#tour-modal-fecha-hasta-field", {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 56,
                padding: isDatesActive ? "0 13px" : "0 14px",
                fontSize: 16,
              })}
            >
              <span style={{ color: "#1e293b" }}>15/07/2026</span>
              <svg style={{ width: 18, height: 18, fill: "#64748b" }} viewBox="0 0 24 24">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v16c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H5V8h14v13z" />
              </svg>
            </div>
          </div>
        </div>

        <div
          id="tour-modal-observaciones-field"
          style={fakeFieldStyle(isObsActive, {
            display: "flex",
            alignItems: "flex-start",
            minHeight: 92,
            padding: isObsActive ? "15px 13px" : "16px 14px",
            fontSize: 16,
          })}
        >
          <span style={{ color: "#94a3b8" }}>Observaciones</span>
        </div>
      </div>
    </GenericTourModal>
  );
};

export const eventoModalTargets = [
  "#tour-evento-tipo",
  "#tour-evento-observaciones-field",
  "#tour-evento-acciones",
];

export const FakeEventoModal: React.FC<{ open: boolean; activeField: string | null }> = ({
  open,
  activeField,
}) => {
  if (!open) return null;

  const isModalStep = eventoModalTargets.includes(activeField || "");
  const isTipoActive = activeField === "#tour-evento-tipo";
  const isObsActive = activeField === "#tour-evento-observaciones-field";
  const isAccionesActive = activeField === "#tour-evento-acciones";

  return (
    <GenericTourModal
      title="Reporta un evento"
      maxWidth={444}
      dimContent={isModalStep}
      dimFooter={!isAccionesActive}
      footer={
        <div
          id="tour-evento-acciones"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 16,
            width: "100%",
            position: "relative",
            zIndex: isAccionesActive ? 6 : 1,
            border: isAccionesActive ? "3px solid #008CFF" : "3px solid transparent",
            borderRadius: isAccionesActive ? 8 : 0,
            padding: isAccionesActive ? 6 : 0,
            boxShadow: isAccionesActive ? "0 0 8px rgba(0, 140, 255, 0.35)" : "none",
            transition: "all 0.1s ease",
          }}
        >
          <FakeCancelButton />
          <FakePrimaryButton />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: "0.85rem", color: "#475569" }}>
          Escoja la novedad presentada para ej. Andrea Soto:
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Evento</div>
          <div
            id="tour-evento-tipo"
            style={fakeFieldStyle(isTipoActive, {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 56,
              padding: isTipoActive ? "0 13px" : "0 14px",
              fontSize: 16,
            })}
          >
            <span style={{ color: "rgba(0, 0, 0, 0.87)" }}>{EVENTO.iniciarPausaActiva}</span>
            <svg style={{ width: 24, height: 24, fill: "rgba(0, 0, 0, 0.54)" }} viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>

        <div>
          <div
            id="tour-evento-observaciones-field"
            style={fakeFieldStyle(isObsActive, {
              display: "flex",
              alignItems: "flex-start",
              minHeight: 92,
              padding: isObsActive ? "15px 13px" : "16.5px 14px",
              fontSize: 16,
            })}
          >
            <span style={{ color: "rgba(0, 0, 0, 0.6)" }}>Observaciones</span>
          </div>
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "rgba(0, 0, 0, 0.6)", marginTop: 4, fontWeight: 500 }}>
            0/{MAX_CARACTERES_OBSERVACION} caracteres
          </div>
        </div>
      </div>
    </GenericTourModal>
  );
};

export const countdownTargets = ["#tour-countdown-box"];

export const FakeCountdownCard: React.FC<{ open: boolean }> = ({ open }) => {
  if (!open) return null;

  const rowIconBox = (enabled: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    border: "1px solid",
    borderColor: enabled ? "#cbd5e1" : "#e2e8f0",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  });

  const rowStyle = (variant: "outlined" | "filled" | "plain"): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#94a3b8",
    border: variant === "outlined" ? "1px solid #cbd5e1" : "1px solid transparent",
    backgroundColor: variant === "filled" ? "#e2e8f0" : "transparent",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      }}
    >
      <div
        style={{
          position: "relative",
          width: 440,
          backgroundColor: "#004680",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
          margin: 16,
        }}
      >
        <div
          style={{
            color: "#fff",
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, paddingRight: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, textTransform: "capitalize", lineHeight: 1.2 }}>
              Andrea Soto
            </span>
            <span style={{ fontWeight: 500, fontSize: 11.2, opacity: 0.85, textTransform: "uppercase", marginTop: 2.4, letterSpacing: "0.5px" }}>
              Gerente online
            </span>
            <span style={{ fontSize: 10.4, fontWeight: 600, opacity: 0.75, textTransform: "uppercase", marginTop: 4, letterSpacing: "0.5px" }}>
              Pausa activa pendiente
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
              <path d="M9 16h2V8H9v8zm3-14C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.58 8 8-3.58 8-8 8zm1-4h2V8h-2v8z" />
            </svg>
            <span
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                fontWeight: 700,
                fontSize: 10.4,
                height: 24,
                display: "inline-flex",
                alignItems: "center",
                padding: "0 10px",
                borderRadius: 12,
                whiteSpace: "nowrap",
                boxSizing: "border-box",
              }}
            >
              JORNADA INICIADA
            </span>
          </div>
        </div>

        <div style={{ backgroundColor: "#fff", padding: 24, position: "relative" }}>
          <div
            id="tour-countdown-box"
            style={{
              backgroundColor: "#ffffff",
              border: "3px solid #008CFF",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 6,
              boxShadow: "0 0 8px rgba(0, 140, 255, 0.35)",
            }}
          >
            <span style={{ fontSize: 9.6, fontWeight: 700, color: "#0e7490", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Pausas activas
            </span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#0891b2", marginTop: 4 }}>4:59</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={rowIconBox(true)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#004680">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <div style={rowStyle("outlined")}>
                <span>Comenzar jornada</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>10:04 AM</span>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="#16a34a">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.58 8 8-3.58 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" />
                  </svg>
                </span>
              </div>
              <div style={rowIconBox(true)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#004680">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7-.75c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zM14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={rowIconBox(false)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <div style={rowStyle("filled")}>
                <span>Iniciar almuerzo</span>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#94a3b8">
                  <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
                </svg>
              </div>
              <div style={rowIconBox(false)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7-.75c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zM14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={rowIconBox(false)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <div style={rowStyle("plain")}>
                <span>Finalizar almuerzo</span>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#94a3b8">
                  <path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.20-1.10-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" />
                </svg>
              </div>
              <div style={rowIconBox(false)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7-.75c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zM14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={rowIconBox(false)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <div style={rowStyle("plain")}>
                <span>Terminar jornada</span>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#94a3b8">
                  <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <div style={rowIconBox(false)}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7-.75c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zM14 17H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
            </div>

          </div>

          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              zIndex: 5,
              pointerEvents: "none",
              borderRadius: "0 0 12px 12px",
            }}
          />
        </div>
      </div>
    </div>
  );
};