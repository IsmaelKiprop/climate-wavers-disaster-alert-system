import React, { useMemo, useRef, useState } from 'react';
import { IoDownload, IoShare, IoClose, IoCheckmarkCircle } from 'react-icons/io5';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { SITE } from '../config/site';

const qrImageUrl = (text, size = 160) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&ecc=M&data=${encodeURIComponent(
    text
  )}`;

const TreeCertificate = ({
  isOpen,
  onClose,
  certificateData,
  onDownload,
  onShare,
  isDownloaded = false,
}) => {
  const certificateRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const trees = Number(certificateData?.treesPlanted || certificateData?.trees_planted || 1);
  const amount = Number(certificateData?.amount || 0);
  const certId =
    certificateData?.certificateId ||
    certificateData?.certificate_id ||
    'CW-pending';
  const donorName =
    certificateData?.userName ||
    certificateData?.user_name ||
    certificateData?.donor_name ||
    'Climate Wavers supporter';
  const giftedRaw = certificateData?.gifted_to || certificateData?.giftedTo || '';
  const giftedTo =
    giftedRaw && giftedRaw.trim().toLowerCase() !== String(donorName).trim().toLowerCase()
      ? giftedRaw
      : '';
  const species = String(
    certificateData?.species ||
      certificateData?.treeType ||
      certificateData?.tree_type ||
      'Verified seedling'
  ).replace(/×/g, 'x');
  const location = certificateData?.location || 'Africa';
  const plantingDate =
    certificateData?.plantingDate ||
    certificateData?.planting_date ||
    new Date().toLocaleDateString();
  const co2 = certificateData?.co2Absorption || certificateData?.co2_absorption || '22';
  const projectName =
    certificateData?.project_name || certificateData?.projectName || 'Climate Wavers project';
  const orgName =
    certificateData?.organization_name || certificateData?.organizationName || '';
  const paymentRef =
    certificateData?.payment_reference || certificateData?.paymentReference || '';

  const verifyUrl = useMemo(() => {
    const base = (SITE.url || window.location.origin || '').replace(/\/$/, '');
    return `${base}/verify/tree/${encodeURIComponent(certId)}`;
  }, [certId]);

  const treeWord = trees === 1 ? 'tree' : 'trees';
  const prose = giftedTo
    ? `In honour of your generosity, ${trees} ${treeWord} will be planted as a gift for ${giftedTo}, supporting ${projectName} in ${location}. Your kindness helps restore living landscapes and strengthens climate resilience across Africa, with an estimated ${co2} kg of CO2 absorbed each year.${orgName ? ` This planting is hosted by ${orgName}.` : ''}`
    : `In recognition of your commitment to a greener future, ${trees} ${treeWord} will be planted through Climate Wavers for ${projectName} in ${location}. Your contribution nurtures ecosystems, uplifts local communities, and advances climate action across Africa, absorbing an estimated ${co2} kg of CO2 each year.${orgName ? ` This planting is hosted by ${orgName}.` : ''}`;

  const handleDownload = async () => {
    if (downloading || !certificateRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#fcfbf8',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageW = 297;
      const pageH = 210;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const y = Math.max(0, (pageH - Math.min(imgH, pageH)) / 2);
      pdf.addImage(imgData, 'PNG', 0, y, imgW, Math.min(imgH, pageH));
      pdf.save(`ClimateWavers_Certificate_${certId}.pdf`);
      if (onDownload) onDownload(certId);
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    const text = `I planted ${trees} tree${trees > 1 ? 's' : ''} with Climate Wavers (${certId}). Verify: ${verifyUrl}`;
    if (navigator.share) {
      navigator.share({ title: 'Climate Wavers tree certificate', text, url: verifyUrl });
    } else {
      navigator.clipboard.writeText(text);
    }
    if (onShare) onShare();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[94vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Climate Wavers</p>
            <h2 className="text-lg font-semibold text-slate-900">Certificate preview</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1" aria-label="Close">
            <IoClose className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div
            ref={certificateRef}
            className="relative mx-auto w-full max-w-[860px] aspect-[16/9] bg-[#fcfbf8] text-center overflow-hidden"
            style={{
              border: '10px solid #0c303a',
              boxShadow: 'inset 0 0 0 3px #b8943c, inset 0 0 0 5px #067d83',
              fontFamily: 'Georgia, "Times New Roman", serif',
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(240,238,232,0.55) 0 1px, transparent 1px 14px)',
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

            <div className="relative h-full flex flex-col px-8 sm:px-12 pt-6 pb-4">
              <div className="inline-block bg-black p-1.5 mx-auto mb-3">
                <img src="/logo.jpg" alt="Climate Wavers" className="h-11 sm:h-12 w-auto object-contain" />
              </div>

              <h1
                className="text-[#0c303a] text-xl sm:text-3xl font-bold tracking-wide uppercase"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Certificate of Plantation
              </h1>

              <div className="flex items-center justify-center gap-3 my-3">
                <div className="h-0.5 flex-1 max-w-[140px] bg-[#b8943c]" />
                <div className="w-2.5 h-2.5 rotate-45 bg-[#b8943c]" />
                <div className="h-0.5 flex-1 max-w-[140px] bg-[#b8943c]" />
              </div>

              <p className="text-[10px] sm:text-[11px] font-sans font-semibold uppercase tracking-[0.18em] text-slate-500">
                The following award is given to
              </p>
              <p
                className="mt-2 text-2xl sm:text-4xl font-bold text-slate-900"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {donorName}
              </p>
              <div className="mx-auto mt-2 h-0.5 w-44 sm:w-56 bg-[#b8943c]" />

              <p
                className="mt-3 text-xs sm:text-[15px] leading-relaxed text-slate-700 max-w-2xl mx-auto"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {prose}
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-4 text-center font-sans max-w-xl mx-auto w-full">
                {[
                  { label: 'Trees', value: String(trees) },
                  { label: 'Species', value: species },
                  { label: 'Issued', value: plantingDate },
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

              <p className="mt-2 font-mono text-[9px] text-slate-500">
                ID {certId}
                {paymentRef ? ` · Ref ${paymentRef}` : ''}
                {amount > 0 ? ` · KES ${amount.toLocaleString()}` : ''}
              </p>

              <div className="mt-4 flex items-end justify-between gap-2 sm:gap-3">
                <div className="shrink-0 text-center w-[76px] sm:w-[92px]">
                  <div className="relative mx-auto h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-[#b8943c] flex items-center justify-center bg-[#f4f7f5]">
                    <svg viewBox="0 0 64 64" className="h-10 w-10 sm:h-11 sm:w-11" aria-hidden>
                      <ellipse cx="32" cy="50" rx="14" ry="4" fill="#e2e8e4" />
                      <rect x="29" y="32" width="6" height="16" rx="1.5" fill="#785230" />
                      <circle cx="32" cy="18" r="10" fill="#055a5f" />
                      <circle cx="23" cy="25" r="8" fill="#067d83" />
                      <circle cx="41" cy="25" r="8" fill="#067d83" />
                      <circle cx="32" cy="28" r="9" fill="#089194" />
                    </svg>
                  </div>
                  <p className="mt-1.5 text-[8px] uppercase tracking-wide text-[#067d83] font-sans font-semibold leading-none">
                    {trees === 1 ? 'Tree planted' : `${trees} trees planted`}
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
                        <svg viewBox="0 0 40 36" className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden>
                          <rect x="18" y="20" width="4" height="12" rx="1" fill="#b8943c" />
                          <circle cx="20" cy="10" r="7" fill="#067d83" />
                          <circle cx="13" cy="16" r="6" fill="#089194" />
                          <circle cx="27" cy="16" r="6" fill="#089194" />
                        </svg>
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
                    style={{ fontFamily: 'Georgia, serif' }}
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
                  />
                </div>
              </div>

              <p className="mt-3 text-[9px] sm:text-[10px] text-slate-400 font-sans">
                Climate Wavers - Powered by FlowOps Africa - Digitally issued
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            {!isDownloaded ? (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 bg-[#067d83] hover:bg-[#056a6f] disabled:opacity-60 text-white font-medium py-3 px-5 flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Generating…
                  </>
                ) : (
                  <>
                    <IoDownload className="w-5 h-5" />
                    Download PDF
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 bg-slate-100 text-slate-600 font-medium py-3 px-5 flex items-center justify-center gap-2">
                <IoCheckmarkCircle className="w-5 h-5 text-[#067d83]" />
                Downloaded
              </div>
            )}
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 border border-slate-300 hover:border-[#067d83] text-slate-800 font-medium py-3 px-5 flex items-center justify-center gap-2"
            >
              <IoShare className="w-5 h-5" />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeCertificate;
