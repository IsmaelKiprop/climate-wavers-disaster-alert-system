import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IoClose, IoDownloadOutline, IoCopyOutline, IoCreateOutline } from "react-icons/io5";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { SITE } from "../config/site";
import BrandLogo from "./BrandLogo";

const fieldClass =
  "w-full h-10 border border-border bg-background px-3 text-sm text-foreground";

/**
 * Branded Community Champion certificate (training path completion).
 * Optional editable name / affiliation / location before download.
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
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const w = 297;
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, w, Math.min(h, 210));
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

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(8,12,12,0.78)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="champion-cert-title"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border w-full max-w-4xl max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p id="champion-cert-title" className="text-sm font-semibold text-foreground">
              Community Champion Certificate
            </p>
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
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 inline-flex items-center justify-center border border-border"
                aria-label="Close"
              >
                <IoClose size={20} />
              </button>
            </div>
          </div>
        </div>

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

        <div className="p-4 sm:p-6 bg-background">
          <div
            ref={ref}
            className="bg-white text-[#111111] mx-auto relative"
            style={{
              maxWidth: 920,
              border: "10px solid #067d83",
              boxShadow: "inset 0 0 0 2px #0a4f53",
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#067d83]" />
            <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#067d83]" />

            <div className="p-6 sm:p-10">
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#067d83]">
                <div>
                  <BrandLogo imgClassName="h-11 sm:h-14 w-auto" />
                  <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[#067d83] font-semibold">
                    Climate Wavers · Resilience Cycle
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#6b7280] mt-1">
                    Detect · Verify · Alert · Respond · Restore
                  </p>
                </div>
                <div className="text-right text-xs text-[#6b7280] leading-relaxed">
                  <p className="font-semibold text-[#111111]">{SITE.org.name}</p>
                  <p>{SITE.org.city}</p>
                  <p className="mt-1">{SITE.domain}</p>
                </div>
              </div>

              <div className="text-center py-7 sm:py-9">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#067d83] font-semibold">
                  Certificate of Completion
                </p>
                <h1 className="mt-3 text-2xl sm:text-[2.5rem] font-semibold tracking-tight leading-tight">
                  Community Champion
                </h1>
                <p className="mt-3 text-sm sm:text-base text-[#6b7280] max-w-2xl mx-auto leading-relaxed">
                  Awarded for completing the Climate Wavers Champion training path —
                  ground-truth verification, safe evidence, warn-nearby ethics,
                  blackout relay, and restore mobilisation.
                </p>
              </div>

              <div className="text-center mb-8">
                <p className="text-sm text-[#6b7280]">This certifies that</p>
                <p className="mt-2 text-2xl sm:text-3xl font-semibold text-[#067d83]">
                  {preview.holder_name}
                </p>
                {preview.affiliation ? (
                  <p className="mt-1 text-sm text-[#6b7280]">{preview.affiliation}</p>
                ) : null}
                {preview.territory ? (
                  <p className="text-sm text-[#6b7280]">{preview.territory}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-[#d1d5db] mb-8 text-sm">
                <div className="p-4 sm:border-r border-[#d1d5db]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                    Program
                  </p>
                  <p className="font-medium mt-1.5">{preview.program}</p>
                </div>
                <div className="p-4 sm:border-r border-[#d1d5db]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                    Modules passed
                  </p>
                  <p className="font-medium mt-1.5">
                    {preview.modules_completed}/{preview.modules_total} · quiz ≥ 70%
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                    Champion tier
                  </p>
                  <p className="font-medium mt-1.5 capitalize">{preview.tier}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8 pt-2">
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] border-[3px] border-[#067d83] rounded-full inline-flex flex-col items-center justify-center text-[#067d83]"
                    aria-hidden
                  >
                    <span className="text-[10px] font-bold tracking-wider">CW</span>
                    <span className="text-[8px] uppercase tracking-wide mt-0.5">
                      Certified
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                      Certificate ID
                    </p>
                    <p className="font-mono text-sm font-semibold mt-1 break-all">
                      {preview.certificate_code}
                    </p>
                    <p className="text-xs text-[#6b7280] mt-2">Issued {issued}</p>
                  </div>
                </div>

                <div className="text-sm min-w-[200px]">
                  <div className="border-b border-[#111111] pb-1 mb-1 w-44">
                    <p className="font-semibold text-[#111111]">{SITE.org.lead}</p>
                  </div>
                  <p className="text-xs text-[#6b7280]">Program Lead · {SITE.org.name}</p>
                  <p className="text-xs text-[#6b7280] mt-3 max-w-xs leading-relaxed">
                    {preview.verify_hint}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChampionCertificate;
