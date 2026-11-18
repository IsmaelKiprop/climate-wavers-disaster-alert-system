import React, { useRef, useState } from 'react';
import { IoDownload, IoShare, IoClose, IoLeaf, IoCheckmarkCircle } from 'react-icons/io5';
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
  const giftedTo = certificateData?.gifted_to || certificateData?.giftedTo || '';
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
  const projectName = certificateData?.project_name || certificateData?.treeType || species;

  const handleDownload = async () => {
    if (downloading || !certificateRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8fafc',
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

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
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
            className="relative overflow-hidden border border-[#0d9488]/40"
            style={{
              minHeight: '420px',
              background:
                'linear-gradient(145deg, #f8fafc 0%, #ecfdf5 45%, #f0fdfa 100%)',
            }}
          >
            <div
              className="absolute inset-3 pointer-events-none border border-[#067d83]/35"
              aria-hidden
            />
            <div className="relative px-6 sm:px-10 py-8 sm:py-10 text-center">
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="h-11 w-11 rounded-full bg-[#067d83] flex items-center justify-center">
                  <IoLeaf className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold tracking-tight text-[#054f54]">Climate Wavers</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    Powered by FlowOps Africa
                  </p>
                </div>
              </div>

              <p className="text-[11px] uppercase tracking-[0.2em] text-[#067d83] mb-2">
                Certificate of plantation
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-2">
                Thank you for growing hope
              </h1>
              <p className="text-slate-600 max-w-xl mx-auto text-sm sm:text-base mb-6">
                This certifies that{' '}
                <span className="font-semibold text-slate-900">{donorName}</span>
                {giftedTo ? (
                  <>
                    {' '}gifted trees to{' '}
                    <span className="font-semibold text-slate-900">{giftedTo}</span>
                  </>
                ) : null}{' '}
                funded{' '}
                <span className="font-semibold text-[#067d83]">
                  {trees} tree{trees > 1 ? 's' : ''}
                </span>{' '}
                through Climate Wavers.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-6 text-left">
                <div className="bg-white/80 border border-slate-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Species / project</p>
                  <p className="text-sm font-medium text-slate-900 mt-1 line-clamp-2">
                    {species}
                    {projectName && projectName !== species ? (
                      <span className="block text-xs text-slate-500 font-normal mt-0.5">
                        {projectName}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="bg-white/80 border border-slate-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Location</p>
                  <p className="text-sm font-medium text-slate-900 mt-1">{location}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{plantingDate}</p>
                </div>
                <div className="bg-white/80 border border-slate-200 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">Impact</p>
                  <p className="text-sm font-medium text-[#067d83] mt-1">
                    ~{co2} kg CO₂ / tree / year
                  </p>
                  {amount > 0 ? (
                    <p className="text-xs text-slate-500 mt-0.5">
                      KES {amount.toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </div>

              <p className="font-mono text-xs text-slate-500 mb-1">ID {certId}</p>
              <p className="text-[11px] text-slate-400">
                Digitally issued by Climate Wavers · FlowOps Africa
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
