import React, { useRef, useState } from 'react';
import { IoDownload, IoShare, IoClose, IoCheckmarkCircle } from 'react-icons/io5';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  const species =
    certificateData?.species ||
    certificateData?.treeType ||
    certificateData?.tree_type ||
    'Verified seedling';
  const location = certificateData?.location || 'Africa';
  const plantingDate =
    certificateData?.plantingDate ||
    certificateData?.planting_date ||
    new Date().toLocaleDateString();
  const co2 = certificateData?.co2Absorption || certificateData?.co2_absorption || '22';
  const projectName =
    certificateData?.project_name || certificateData?.projectName || '';
  const orgName =
    certificateData?.organization_name || certificateData?.organizationName || '';
  const paymentRef =
    certificateData?.payment_reference || certificateData?.paymentReference || '';

  const handleDownload = async () => {
    if (downloading || !certificateRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f7fafa',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 210));
      pdf.save(`ClimateWavers_Certificate_${certId}.pdf`);

      if (onDownload) onDownload(certId);
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    const text = `I planted ${trees} tree${trees > 1 ? 's' : ''} with Climate Wavers (${certId}). Join me: https://alerts.flowops.africa`;
    if (navigator.share) {
      navigator.share({
        title: 'Climate Wavers tree certificate',
        text,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(text);
    }
    if (onShare) onShare();
  };

  if (!isOpen) return null;

  const action = giftedTo
    ? `gifted ${trees} tree${trees > 1 ? 's' : ''} to ${giftedTo}`
    : `funded the planting of ${trees} tree${trees > 1 ? 's' : ''} with Climate Wavers`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Climate Wavers</p>
            <h2 className="text-lg font-semibold text-slate-900">Tree planting certificate</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
            aria-label="Close"
          >
            <IoClose className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div
            ref={certificateRef}
            className="relative overflow-hidden border-[5px] border-[#067d83] bg-[#f7fafa]"
          >
            <div className="absolute inset-[10px] border-2 border-emerald-200 pointer-events-none" aria-hidden />

            <div className="relative bg-[#067d83] px-5 sm:px-8 py-4 flex items-center gap-3 sm:gap-5">
              <div className="bg-black p-1.5 shrink-0 border border-black/40">
                <img
                  src="/logo.jpg"
                  alt="Climate Wavers"
                  className="h-14 sm:h-16 w-auto object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-lg sm:text-2xl font-semibold tracking-tight">
                  CLIMATE WAVERS
                </p>
                <p className="text-emerald-100 text-xs sm:text-sm mt-0.5">
                  Tree planting certificate · alerts.flowops.africa
                </p>
              </div>
              <div className="shrink-0 text-center">
                <p className="hidden sm:block text-[10px] uppercase tracking-wide text-emerald-100 mb-1">
                  Powered by
                </p>
                <div className="bg-white p-1.5 sm:p-2">
                  <img
                    src="/flowops-logo.png"
                    alt="FlowOps Africa"
                    className="h-10 sm:h-12 w-auto object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="relative px-6 sm:px-10 py-8 text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#067d83] font-semibold">
                Certificate of plantation
              </p>
              <p className="text-sm text-slate-500 mt-3">This certifies that</p>
              <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 mt-2 tracking-tight">
                {donorName}
              </h1>
              <p className="text-base sm:text-lg text-[#054f54] mt-4 max-w-2xl mx-auto">
                {action}
              </p>
              <p className="text-sm font-medium text-slate-800 mt-2">{species}</p>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 border-2 border-emerald-200 bg-emerald-50 text-left">
                {[
                  { label: 'Trees', value: String(trees) },
                  { label: 'Species', value: species },
                  {
                    label: 'Project',
                    value: projectName || 'Climate Wavers project',
                    sub: orgName,
                  },
                  { label: 'Location', value: location },
                  { label: 'CO₂ / year', value: `~${co2} kg` },
                ].map((cell) => (
                  <div
                    key={cell.label}
                    className="px-3 py-4 border-t sm:border-t-0 sm:border-l border-emerald-200 first:border-l-0 first:border-t-0"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-[#067d83] font-semibold">
                      {cell.label}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 mt-1 line-clamp-2">
                      {cell.value}
                    </p>
                    {cell.sub ? (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{cell.sub}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-8 grid sm:grid-cols-[1.1fr_1fr_auto] gap-6 text-left items-end">
                <div>
                  <p className="text-[11px] text-slate-500">Authorized by</p>
                  <p className="text-base font-semibold text-slate-900 mt-1">
                    Kipkoech Ismael Kiprop
                  </p>
                  <p className="text-sm text-slate-500">Founder, Climate Wavers</p>
                  <div className="mt-3 h-0.5 w-40 bg-[#067d83]" />
                  <p className="text-[11px] text-slate-400 mt-1">Digital signature</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                    Certificate ID
                  </p>
                  <p className="font-mono text-xs text-slate-800 mt-1 break-all">{certId}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mt-3">
                    Issued
                  </p>
                  <p className="text-sm text-slate-800 mt-1">{plantingDate}</p>
                  {paymentRef ? (
                    <>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mt-3">
                        Payment ref
                      </p>
                      <p className="font-mono text-xs text-slate-800 mt-1">{paymentRef}</p>
                    </>
                  ) : null}
                  {amount > 0 ? (
                    <p className="text-xs text-slate-500 mt-3">KES {amount.toLocaleString()}</p>
                  ) : null}
                </div>
                <div className="justify-self-center sm:justify-self-end">
                  <div className="h-28 w-28 rounded-full border-[3px] border-[#067d83] flex flex-col items-center justify-center text-center">
                    <div className="h-[5.5rem] w-[5.5rem] rounded-full border-2 border-emerald-200 flex flex-col items-center justify-center">
                      <p className="text-[10px] font-bold text-[#067d83] leading-tight">CLIMATE</p>
                      <p className="text-[10px] font-bold text-[#067d83] leading-tight">WAVERS</p>
                      <p className="text-[9px] text-slate-500 mt-1">VERIFIED</p>
                      <p className="text-[9px] text-slate-500">PLANTING</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#067d83] px-5 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
              <div className="bg-black p-0.5">
                <img src="/logo.jpg" alt="" className="h-7 w-auto object-contain" />
              </div>
              <div className="bg-white p-0.5">
                <img src="/flowops-logo.png" alt="" className="h-7 w-auto object-contain" />
              </div>
              <p className="text-[11px] text-white/95">
                Climate Wavers · Powered by FlowOps Africa · Digitally issued
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
