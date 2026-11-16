import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IoClose, IoDownloadOutline, IoCopyOutline } from "react-icons/io5";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { SITE } from "../config/site";
import BrandLogo from "./BrandLogo";

/**
 * Branded Community Champion certificate (ALX-style path completion).
 * Solid CW brand colors — no decorative gradients.
 */
const ChampionCertificate = ({ isOpen, onClose, certificate }) => {
  const ref = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen || !certificate) return null;

  const issued = certificate.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString(undefined, {
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
        `Climate_Wavers_Champion_${certificate.certificate_code || "cert"}.pdf`
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
      await navigator.clipboard.writeText(certificate.certificate_code || "");
      toast.success("Certificate ID copied");
    } catch {
      toast.error("Could not copy");
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
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <p id="champion-cert-title" className="text-sm font-semibold text-foreground">
            Community Champion Certificate
          </p>
          <div className="flex gap-2">
            {certificate.verify_path ? (
              <Link
                to={certificate.verify_path}
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
                  Awarded for completing the end-to-end ALX-style training path —
                  ground-truth verification, safe evidence, warn-nearby ethics,
                  blackout relay, and restore mobilisation.
                </p>
              </div>

              <div className="text-center mb-8">
                <p className="text-sm text-[#6b7280]">This certifies that</p>
                <p className="mt-2 text-2xl sm:text-3xl font-semibold text-[#067d83]">
                  {certificate.holder_name}
                </p>
                {certificate.affiliation ? (
                  <p className="mt-1 text-sm text-[#6b7280]">
                    {certificate.affiliation}
                  </p>
                ) : null}
                {certificate.territory ? (
                  <p className="text-sm text-[#6b7280]">{certificate.territory}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border border-[#d1d5db] mb-8 text-sm">
                <div className="p-4 sm:border-r border-[#d1d5db]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                    Program
                  </p>
                  <p className="font-medium mt-1.5">{certificate.program}</p>
                </div>
                <div className="p-4 sm:border-r border-[#d1d5db]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                    Modules passed
                  </p>
                  <p className="font-medium mt-1.5">
                    {certificate.modules_completed}/{certificate.modules_total} · quiz ≥ 70%
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">
                    Champion tier
                  </p>
                  <p className="font-medium mt-1.5 capitalize">{certificate.tier}</p>
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
                      {certificate.certificate_code}
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
                    {certificate.verify_hint}
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
