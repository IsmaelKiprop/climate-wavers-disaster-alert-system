import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IoClose, IoDownloadOutline, IoCopyOutline, IoCreateOutline } from "react-icons/io5";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { SITE } from "../config/site";
import BrandLogo from "./BrandLogo";

const TEAL = "#067d83";
const TEAL_DEEP = "#04565a";
const INK = "#0f1717";
const MUTED = "#5c6b6c";
const PAPER = "#fbfcfc";
const RULE = "#c5d4d5";

const serif = '"Playfair Display", Georgia, "Times New Roman", serif';
const sans = 'Montserrat, "Segoe UI", system-ui, sans-serif';
const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const fieldClass =
  "w-full h-10 border border-border bg-background px-3 text-sm text-foreground";

const CornerMark = ({ position }) => {
  const base = {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: TEAL,
    borderStyle: "solid",
    pointerEvents: "none",
  };
  const map = {
    tl: { top: 14, left: 14, borderWidth: "2px 0 0 2px" },
    tr: { top: 14, right: 14, borderWidth: "2px 2px 0 0" },
    bl: { bottom: 14, left: 14, borderWidth: "0 0 2px 2px" },
    br: { bottom: 14, right: 14, borderWidth: "0 2px 2px 0" },
  };
  return <div style={{ ...base, ...map[position] }} aria-hidden />;
};

/**
 * World-class Community Champion certificate — Climate Wavers branded.
 * Editable name / affiliation / location before download.
 */
const ChampionCertificate = ({ isOpen, onClose, certificate, onSaveDetails }) => {
  const ref = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    display_name: "",
    affiliation: "",
    ward: "",
    city: "",
    region: "",
    country: "",
  });
  const [preview, setPreview] = useState(certificate);

  useEffect(() => {
    if (!certificate) return;
    setPreview(certificate);
    setDraft({
      display_name: certificate.holder_name || "",
      affiliation: certificate.affiliation || "",
      ward: certificate.ward || "",
      city: certificate.city_name || "",
      region: certificate.region || "",
      country: certificate.country || "",
    });
    setEditing(false);
  }, [certificate]);

  // Escape app shell overflow/stacking so the modal covers the full viewport
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !preview) return null;

  const canEdit = typeof onSaveDetails === "function";

  const issued = preview.issued_at
    ? new Date(preview.issued_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const downloadPdf = async () => {
    if (!ref.current || downloading) return;
    setDownloading(true);
    try {
      // Wait a tick so web fonts paint into the capture
      await document.fonts?.ready;
      const canvas = await html2canvas(ref.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: PAPER,
        logging: false,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageW = 297;
      const pageH = 210;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const y = Math.max(0, (pageH - Math.min(imgH, pageH)) / 2);
      pdf.addImage(img, "PNG", 0, y, imgW, Math.min(imgH, pageH));
      pdf.save(
        `Climate_Wavers_Champion_${preview.certificate_code || "cert"}.pdf`
      );
      toast.success("Certificate PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(preview.certificate_code || "");
      toast.success("Certificate ID copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const saveDetails = async () => {
    if (!canEdit) return;
    const name = (draft.display_name || "").trim();
    if (!name) {
      toast.error("Name is required on the certificate");
      return;
    }
    setSaving(true);
    try {
      const updated = await onSaveDetails({
        display_name: name,
        affiliation: (draft.affiliation || "").trim(),
        ward: (draft.ward || "").trim(),
        city: (draft.city || "").trim(),
        region: (draft.region || "").trim(),
        country: (draft.country || "").trim() || "Kenya",
      });
      if (updated) setPreview(updated);
      setEditing(false);
      toast.success("Certificate details updated");
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[500] flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(8,14,14,0.88)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="champion-cert-title"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border w-full sm:max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[94dvh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-surface border-b border-border p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p id="champion-cert-title" className="text-sm font-semibold text-foreground">
                  Community Champion Certificate
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  Official Climate Wavers credential · edit details before download
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 shrink-0 inline-flex items-center justify-center border border-border"
                aria-label="Close"
              >
                <IoClose size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="h-10 px-3 border border-border text-sm font-medium inline-flex items-center gap-1.5"
                >
                  <IoCreateOutline size={16} />
                  {editing ? "Hide editor" : "Edit name & place"}
                </button>
              ) : null}
              {preview.verify_path ? (
                <Link
                  to={preview.verify_path}
                  className="h-10 px-3 border border-border text-sm font-medium inline-flex items-center"
                >
                  Verify page
                </Link>
              ) : null}
              <button
                type="button"
                onClick={copyCode}
                className="h-10 px-3 border border-border text-sm font-medium inline-flex items-center gap-1.5"
              >
                <IoCopyOutline size={16} />
                Copy ID
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="h-10 px-3 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5"
              >
                <IoDownloadOutline size={18} />
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

        {editing && canEdit ? (
          <div className="p-4 sm:p-5 border-b border-border bg-background space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted">
              Edit certificate details
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-muted text-xs">Full name on certificate</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={draft.display_name}
                  onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted text-xs">Affiliation / group</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={draft.affiliation}
                  onChange={(e) => setDraft((d) => ({ ...d, affiliation: e.target.value }))}
                  placeholder="School, church, CBO, neighborhood group"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted text-xs">Ward / area</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={draft.ward}
                  onChange={(e) => setDraft((d) => ({ ...d, ward: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted text-xs">City / town</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={draft.city}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                  placeholder="Nairobi"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted text-xs">Region / county</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={draft.region}
                  onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted text-xs">Country</span>
                <input
                  className={`${fieldClass} mt-1`}
                  value={draft.country}
                  onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={saveDetails}
                className="h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save on certificate"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setDraft({
                    display_name: preview.holder_name || "",
                    affiliation: preview.affiliation || "",
                    ward: preview.ward || "",
                    city: preview.city_name || "",
                    region: preview.region || "",
                    country: preview.country || "",
                  });
                  setEditing(false);
                }}
                className="h-10 px-4 border border-border text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div
          className="p-3 sm:p-6 overflow-x-auto"
          style={{ background: "#e8eeee" }}
        >
          <div
            ref={ref}
            style={{
              width: "100%",
              minWidth: 720,
              maxWidth: 980,
              margin: "0 auto",
              background: PAPER,
              color: INK,
              position: "relative",
              border: `3px solid ${TEAL_DEEP}`,
              boxShadow: `inset 0 0 0 1px ${TEAL}, inset 0 0 0 10px ${PAPER}, inset 0 0 0 12px ${RULE}`,
              fontFamily: sans,
            }}
          >
            <CornerMark position="tl" />
            <CornerMark position="tr" />
            <CornerMark position="bl" />
            <CornerMark position="br" />

            {/* Top brand bar */}
            <div
              style={{
                background: TEAL,
                color: "#fff",
                padding: "10px 28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Climate Wavers · Official Credential
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  opacity: 0.92,
                }}
              >
                Resilience Cycle
              </p>
            </div>

            <div style={{ padding: "28px 36px 32px" }}>
              {/* Header row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 20,
                  marginBottom: 22,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <BrandLogo imgClassName="h-14 w-auto" />
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: serif,
                        fontSize: 22,
                        fontWeight: 700,
                        color: INK,
                        lineHeight: 1.15,
                      }}
                    >
                      Climate Wavers
                    </p>
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 10,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: TEAL,
                        fontWeight: 600,
                      }}
                    >
                      Detect · Verify · Alert · Respond · Restore
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: MUTED, lineHeight: 1.55 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: INK, fontSize: 12 }}>
                    {SITE.org.name}
                  </p>
                  <p style={{ margin: "2px 0 0" }}>{SITE.org.city}</p>
                  <p style={{ margin: "2px 0 0" }}>{SITE.domain}</p>
                  <p style={{ margin: "2px 0 0" }}>{SITE.org.contact}</p>
                </div>
              </div>

              <div
                style={{
                  height: 1,
                  background: RULE,
                  marginBottom: 26,
                }}
              />

              {/* Title block */}
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    letterSpacing: "0.34em",
                    textTransform: "uppercase",
                    color: TEAL,
                    fontWeight: 700,
                  }}
                >
                  Certificate of Completion
                </p>
                <h1
                  style={{
                    margin: "10px 0 0",
                    fontFamily: serif,
                    fontSize: "clamp(2rem, 4.2vw, 2.85rem)",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: INK,
                    lineHeight: 1.1,
                  }}
                >
                  Community Champion
                </h1>
                <p
                  style={{
                    margin: "12px auto 0",
                    maxWidth: 620,
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: MUTED,
                  }}
                >
                  Awarded for completing the Climate Wavers Champion training path —
                  ground-truth verification, safe evidence, warn-nearby ethics,
                  blackout relay, and restore mobilisation.
                </p>
              </div>

              {/* Recipient */}
              <div style={{ textAlign: "center", marginBottom: 26 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  This certifies that
                </p>
                <p
                  style={{
                    margin: "10px 0 0",
                    fontFamily: serif,
                    fontSize: "clamp(1.75rem, 3.6vw, 2.55rem)",
                    fontWeight: 700,
                    color: TEAL,
                    lineHeight: 1.15,
                  }}
                >
                  {preview.holder_name}
                </p>
                <div
                  style={{
                    width: 72,
                    height: 2,
                    background: TEAL,
                    margin: "14px auto 12px",
                  }}
                />
                {preview.affiliation ? (
                  <p style={{ margin: 0, fontSize: 14, color: INK, fontWeight: 500 }}>
                    {preview.affiliation}
                  </p>
                ) : null}
                {preview.territory ? (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED }}>
                    {preview.territory}
                  </p>
                ) : null}
              </div>

              {/* Meta strip */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  border: `1px solid ${RULE}`,
                  marginBottom: 28,
                }}
              >
                {[
                  { label: "Program", value: preview.program || "Community Champion Certification" },
                  {
                    label: "Modules passed",
                    value: `${preview.modules_completed}/${preview.modules_total} · quiz ≥ 70%`,
                  },
                  {
                    label: "Champion tier",
                    value: String(preview.tier || "trainee").replace(/^\w/, (c) => c.toUpperCase()),
                  },
                ].map((cell, i) => (
                  <div
                    key={cell.label}
                    style={{
                      padding: "14px 16px",
                      borderRight: i < 2 ? `1px solid ${RULE}` : "none",
                      background: i === 1 ? "#f3f7f7" : PAPER,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: MUTED,
                        fontWeight: 600,
                      }}
                    >
                      {cell.label}
                    </p>
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: 13,
                        fontWeight: 600,
                        color: INK,
                        lineHeight: 1.35,
                      }}
                    >
                      {cell.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Footer: seal + id + signature */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 28,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: "50%",
                      border: `3px solid ${TEAL}`,
                      boxShadow: `inset 0 0 0 5px ${PAPER}, inset 0 0 0 7px ${TEAL_DEEP}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: TEAL,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em" }}>
                      CW
                    </span>
                    <span
                      style={{
                        fontSize: 7,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      Certified
                    </span>
                  </div>
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: MUTED,
                        fontWeight: 600,
                      }}
                    >
                      Certificate ID
                    </p>
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontFamily: mono,
                        fontSize: 13,
                        fontWeight: 700,
                        color: INK,
                        letterSpacing: "0.02em",
                        wordBreak: "break-all",
                      }}
                    >
                      {preview.certificate_code}
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>
                      Issued {issued}
                    </p>
                  </div>
                </div>

                <div style={{ minWidth: 200 }}>
                  <div
                    style={{
                      borderBottom: `1.5px solid ${INK}`,
                      paddingBottom: 6,
                      marginBottom: 6,
                      width: 200,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontFamily: serif,
                        fontSize: 16,
                        fontWeight: 700,
                        color: INK,
                      }}
                    >
                      {SITE.org.lead}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: MUTED }}>
                    Program Lead · {SITE.org.name}
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 11,
                      color: MUTED,
                      maxWidth: 240,
                      lineHeight: 1.45,
                    }}
                  >
                    Authenticity: {SITE.domain}
                    {preview.verify_path || "/verify/champion"}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div
              style={{
                borderTop: `1px solid ${RULE}`,
                padding: "10px 28px",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: MUTED,
                fontWeight: 600,
              }}
            >
              <span>Climate Wavers Disaster Alert System</span>
              <span style={{ color: TEAL }}>Protect · Prepare · Restore</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ChampionCertificate;
