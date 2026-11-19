import jsPDF from "jspdf";

/**
 * Branded landscape PDF for a Plastic Pulse impact certificate.
 */
export function downloadPlasticCertificatePdf(cert, { recovery } = {}) {
  if (!cert?.code) return;

  const pdf = new jsPDF("landscape", "mm", "a4");
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  // Atmosphere: deep teal field (Climate Wavers primary family)
  pdf.setFillColor(6, 80, 84);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(8, 110, 116);
  pdf.rect(10, 10, W - 20, H - 20, "F");
  pdf.setDrawColor(180, 230, 232);
  pdf.setLineWidth(0.6);
  pdf.rect(14, 14, W - 28, H - 28, "S");

  pdf.setTextColor(220, 245, 246);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("CLIMATE WAVERS  ·  FLOWOPS AFRICA", W / 2, 28, { align: "center" });

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(28);
  pdf.text("Plastic Pulse Certificate", W / 2, 48, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(200, 235, 236);
  pdf.text("Verified plastic recovery · chain of custody closed", W / 2, 58, {
    align: "center",
  });

  const holder = cert.holder_name || "Climate Wavers recovery";
  const kg = cert.kg != null ? String(cert.kg) : "—";
  const project = cert.project_name || "Plastic Pulse project";
  const org = cert.organization_name ? ` · ${cert.organization_name}` : "";
  const bag = recovery?.bag_id || "—";
  const polymer = recovery?.polymer_type || "—";
  const issued = cert.issued_at
    ? new Date(cert.issued_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.text("This certifies that", W / 2, 78, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(holder, W / 2, 90, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(220, 245, 246);
  const lines = [
    `${kg} kg verified plastic recovered`,
    `Project: ${project}${org}`,
    `Bag ID: ${bag}  ·  Type: ${polymer}`,
    `Issued: ${issued}`,
  ];
  let y = 108;
  lines.forEach((line) => {
    pdf.text(line, W / 2, y, { align: "center" });
    y += 9;
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Certificate ID: ${cert.code}`, W / 2, H - 32, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(180, 220, 222);
  pdf.text(
    "Verify at alerts.flowops.africa/verify/plastic/" + cert.code,
    W / 2,
    H - 24,
    { align: "center" }
  );

  pdf.save(`Climate-Wavers-Plastic-${cert.code}.pdf`);
}
