import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { SITE } from "../config/site";
import { polymerResinCode } from "../utils/plasticPolymers";

export { polymerResinCode };

const qrImageUrl = (text, size = 160) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&ecc=M&data=${encodeURIComponent(
    text
  )}`;

function PlasticResinMark({ polymer, className = "h-14 w-14" }) {
  const { code, label } = polymerResinCode(polymer);
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 8l6.5 11.2H51L44.5 30.5 51 41.8H38.5L32 53l-6.5-11.2H13L19.5 30.5 13 19.2h12.5z"
        fill="none"
        stroke="#067d83"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M29 14l3-5 3 5h-2.2v5.5h-1.6V14H29z" fill="#067d83" />
      <path d="M44 24.5l5 2.2-2.8 5.2-4.2-1.5 1.2-4.2z" fill="#067d83" />
      <path d="M20 24.5l-5 2.2 2.8 5.2 4.2-1.5-1.2-4.2z" fill="#067d83" />
      <text
        x="32"
        y="34"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#0c303a"
        fontFamily="system-ui,sans-serif"
      >
        {code}
      </text>
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fontSize="7"
        fontWeight="600"
        fill="#067d83"
        fontFamily="system-ui,sans-serif"
        letterSpacing="0.06em"
      >
        {label}
      </text>
    </svg>
  );
}

/**
 * Branded Plastic Pulse certificate — same visual language as tree certificates.
 */
const PlasticCertificate = ({
  certificate,
  recovery = null,
  showActions = true,
  onDownloaded,
}) => {
  const certificateRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const certId = certificate?.code || "CW-PL-pending";
  const holder =
    certificate?.holder_name ||
    recovery?.holder_name ||
    "Climate Wavers recovery";
  const kg = certificate?.kg != null ? String(certificate.kg) : "—";
  const project =
    certificate?.project_name || recovery?.project_name || "Plastic Pulse project";
  const org = certificate?.organization_name || "";
  const bag = recovery?.bag_id || "—";
  const polymer = recovery?.polymer_type || "mixed";
  const issued = certificate?.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString();

  const verifyUrl = useMemo(() => {
    const base = (SITE.url || (typeof window !== "undefined" ? window.location.origin : "")).replace(
      /\/$/,
      ""
    );
    return `${base}/verify/plastic/${encodeURIComponent(certId)}`;
  }, [certId]);

  const prose = `In recognition of verified plastic recovery through Climate Wavers Plastic Pulse, ${kg} kg of ${polymerResinCode(polymer).label} material was collected, CBO-verified, and confirmed at recycler intake for ${project}${org ? ` (${org})` : ""}. This closes the chain of custody and supports cleaner waterways and flood-resilient communities across Africa.`;

  const handleDownload = async () => {
    if (downloading || !certificateRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#fcfbf8",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageW = 297;
      const pageH = 210;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const y = Math.max(0, (pageH - Math.min(imgH, pageH)) / 2);
      pdf.addImage(imgData, "PNG", 0, y, imgW, Math.min(imgH, pageH));
      pdf.save(`ClimateWavers_Plastic_${certId}.pdf`);
      toast.success("PDF downloaded");
      onDownloaded?.(certId);
    } catch (err) {
      console.error(err);
      toast.error("Could not create PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={certificateRef}
        className="relative mx-auto w-full max-w-[860px] aspect-[16/9] bg-[#fcfbf8] text-center overflow-hidden"
        style={{
          border: "10px solid #0c303a",
          boxShadow: "inset 0 0 0 3px #b8943c, inset 0 0 0 5px #067d83",
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute top-0 left-0 w-[72px] h-[14px] bg-[#067d83]" />
          <div className="absolute top-0 left-0 w-[14px] h-[72px] bg-[#067d83]" />
          <div className="absolute top-[7px] left-[7px] w-[52px] h-[4px] bg-[#b8943c]" />
          <div className="absolute top-[7px] left-[7px] w-[4px] h-[52px] bg-[#b8943c]" />
          <div className="absolute top-0 right-0 w-[84px] h-[16px] bg-[#0c303a]" />
          <div className="absolute top-0 right-0 w-[16px] h-[84px] bg-[#0c303a]" />
          <div className="absolute top-[8px] right-[8px] w-[60px] h-[4px] bg-[#b8943c]" />
          <div className="absolute top-[8px] right-[8px] w-[4px] h-[60px] bg-[#b8943c]" />
          <div className="absolute bottom-0 left-0 w-[84px] h-[16px] bg-[#0c303a]" />
          <div className="absolute bottom-0 left-0 w-[16px] h-[84px] bg-[#0c303a]" />
          <div className="absolute bottom-[8px] left-[8px] w-[60px] h-[4px] bg-[#b8943c]" />
          <div className="absolute bottom-[8px] left-[8px] w-[4px] h-[60px] bg-[#b8943c]" />
          <div className="absolute bottom-0 right-0 w-[72px] h-[14px] bg-[#067d83]" />
          <div className="absolute bottom-0 right-0 w-[14px] h-[72px] bg-[#067d83]" />
          <div className="absolute bottom-[7px] right-[7px] w-[52px] h-[4px] bg-[#b8943c]" />
          <div className="absolute bottom-[7px] right-[7px] w-[4px] h-[52px] bg-[#b8943c]" />
        </div>

        <div className="relative h-full flex flex-col px-8 sm:px-12 pt-5 pb-3">
          <div className="inline-block bg-black p-1.5 mx-auto mb-2">
            <img
              src="/logo.jpg"
              alt="Climate Wavers"
              className="h-10 sm:h-11 w-auto object-contain"
              crossOrigin="anonymous"
            />
          </div>

          <h1
            className="text-[#0c303a] text-xl sm:text-3xl font-bold tracking-wide uppercase"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Plastic Pulse Certificate
          </h1>

          <div className="flex items-center justify-center gap-3 my-2">
            <div className="h-0.5 flex-1 max-w-[140px] bg-[#b8943c]" />
            <div className="w-2.5 h-2.5 rotate-45 bg-[#b8943c]" />
            <div className="h-0.5 flex-1 max-w-[140px] bg-[#b8943c]" />
          </div>

          <p className="text-[10px] sm:text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-slate-500">
            Verified recovery awarded to
          </p>
          <p
            className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {holder}
          </p>
          <div className="mx-auto mt-1.5 h-0.5 w-44 sm:w-56 bg-[#b8943c]" />

          <p
            className="mt-2.5 text-xs sm:text-[14px] leading-relaxed text-slate-700 max-w-2xl mx-auto"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {prose}
          </p>

          <div className="mt-2.5 grid grid-cols-4 gap-2 sm:gap-3 text-center font-sans max-w-2xl mx-auto w-full">
            {[
              { label: "Kg verified", value: kg },
              { label: "Polymer", value: polymerResinCode(polymer).label },
              { label: "Bag ID", value: bag },
              { label: "Issued", value: issued },
            ].map((d) => (
              <div key={d.label}>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-[#067d83] font-semibold">
                  {d.label}
                </p>
                <p className="text-[11px] sm:text-sm font-medium text-slate-900 mt-0.5 line-clamp-2">
                  {d.value}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-1.5 font-mono text-[9px] text-slate-500">
            ID {certId}
            {project ? ` · ${project}` : ""}
          </p>

          <div className="mt-3 flex items-end justify-between gap-2 sm:gap-3">
            <div className="shrink-0 text-center w-[76px] sm:w-[92px]">
              <div className="relative mx-auto h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-[#b8943c] flex items-center justify-center bg-[#f4f7f5]">
                <PlasticResinMark polymer={polymer} className="h-11 w-11 sm:h-12 sm:w-12" />
              </div>
              <p className="mt-1.5 text-[8px] uppercase tracking-wide text-[#067d83] font-sans font-semibold leading-none">
                Plastic recovered
              </p>
            </div>

            <div className="flex items-end gap-3 sm:gap-5 shrink-0">
              <div className="text-center">
                <div className="border-2 border-[#b8943c] bg-white p-0.5 inline-block">
                  <img
                    src={qrImageUrl(verifyUrl)}
                    alt="Scan to verify certificate"
                    className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
                    crossOrigin="anonymous"
                  />
                </div>
                <p className="text-[8px] uppercase tracking-wide text-[#067d83] font-sans font-semibold mt-1">
                  Scan to verify
                </p>
              </div>

              <div className="relative h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]">
                <div className="absolute left-1/2 top-[55%] -translate-x-[110%] w-4 h-8 bg-[#055a5f] origin-top -rotate-[18deg]" />
                <div className="absolute left-1/2 top-[55%] translate-x-[10%] w-4 h-8 bg-[#067d83] origin-top rotate-[18deg]" />
                <div className="relative h-full w-full rounded-full bg-[#b8943c] border-2 border-[#0c303a] flex items-center justify-center">
                  <div className="h-[78%] w-[78%] rounded-full bg-[#0c303a] border border-[#d4b462] flex flex-col items-center justify-center font-sans px-1">
                    <span className="text-lg sm:text-xl font-bold text-[#d4b462] leading-none">
                      {polymerResinCode(polymer).code}
                    </span>
                    <p className="text-[8px] sm:text-[9px] font-bold text-[#d4b462] leading-none mt-0.5 tracking-wide">
                      VERIFIED
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 max-w-[140px] sm:max-w-[180px]">
              <p
                className="text-sm sm:text-base font-bold text-slate-900 leading-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {SITE.org.lead}
              </p>
              <div className="ml-auto mt-1 h-0.5 w-28 sm:w-36 bg-[#b8943c]" />
              <p className="mt-1 text-[9px] sm:text-[10px] text-slate-500 font-sans leading-snug">
                Founder &amp; CEO of {SITE.org.name}
              </p>
              <img
                src="/flowops-logo.png"
                alt="FlowOps"
                className="h-8 sm:h-9 w-auto object-contain ml-auto mt-1"
                crossOrigin="anonymous"
              />
            </div>
          </div>

          <p className="mt-2 text-[9px] sm:text-[10px] text-slate-400 font-sans">
            Climate Wavers · Plastic Pulse · Powered by FlowOps Africa · Digitally issued
          </p>
        </div>
      </div>

      {showActions ? (
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
          <a
            href={verifyUrl}
            className="h-10 px-4 border border-border text-sm inline-flex items-center"
          >
            Open verify link
          </a>
        </div>
      ) : null}
    </div>
  );
};

export default PlasticCertificate;
