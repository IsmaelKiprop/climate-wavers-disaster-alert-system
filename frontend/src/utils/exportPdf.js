import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Capture an element to a multi-page A4 PDF without mid-page duplication.
 * Temporarily locks a desktop capture width so charts/tables stay aligned.
 */
export async function exportElementToPdf(element, {
  fileName = "ClimateWavers_Report.pdf",
  backgroundColor = "#ffffff",
  captureWidth = 900,
} = {}) {
  if (!element) throw new Error("Nothing to export");

  const previous = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    margin: element.style.margin,
    boxSizing: element.style.boxSizing,
  };

  element.style.width = `${captureWidth}px`;
  element.style.maxWidth = `${captureWidth}px`;
  element.style.margin = "0 auto";
  element.style.boxSizing = "border-box";

  // Let layout settle after width lock (charts resize).
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 120));

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor,
      logging: false,
      windowWidth: captureWidth,
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidthMm = pageWidth - margin * 2;
    const contentHeightMm = pageHeight - margin * 2;

    const pxPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = Math.floor(contentHeightMm * pxPerMm);

    let sourceY = 0;
    let pageIndex = 0;

    while (sourceY < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - sourceY);
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeightPx;

      const ctx = pageCanvas.getContext("2d");
      ctx.fillStyle = backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      const sliceMm = sliceHeightPx / pxPerMm;
      const dataUrl = pageCanvas.toDataURL("image/png");

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(dataUrl, "PNG", margin, margin, contentWidthMm, sliceMm);

      sourceY += sliceHeightPx;
      pageIndex += 1;
    }

    pdf.save(fileName);
  } finally {
    element.style.width = previous.width;
    element.style.maxWidth = previous.maxWidth;
    element.style.margin = previous.margin;
    element.style.boxSizing = previous.boxSizing;
  }
}

/** Drop leaked prompt text from AI briefings. */
export function sanitizeAiBrief(text, fallback = "") {
  const raw = String(text || "").trim();
  if (!raw) return fallback;
  const looksLikePrompt =
    /write a short/i.test(raw) ||
    /max 120 words/i.test(raw) ||
    /tone:\s*/i.test(raw) ||
    /no fearmongering/i.test(raw) ||
    /no greenwashing/i.test(raw);
  if (looksLikePrompt) return fallback || raw.split(/\n\n/).slice(-2).join("\n\n");
  return raw;
}
