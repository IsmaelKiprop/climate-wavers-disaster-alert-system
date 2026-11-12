import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { IoDownloadOutline, IoRefreshOutline, IoSparklesOutline } from "react-icons/io5";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { fetchTreeStats } from "../utils/apiData";
import { buildTreeAnalytics, treeAnalyticsPrompt } from "../utils/treeAnalytics";
import { useTheme } from "../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TEAL = "#0D9488";
const TEAL_DARK = "#2bb8bf";

function chartTheme(isDark) {
  const muted = isDark ? "#9ca3af" : "#6B7280";
  const ink = isDark ? "#f3f5f5" : "#111827";
  const grid = isDark ? "#2d3737" : "#E5E7EB";
  const accent = isDark ? TEAL_DARK : TEAL;
  return { muted, ink, grid, accent };
}

function buildBaseOptions(isDark) {
  const { muted, ink, grid, accent } = chartTheme(isDark);
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: { color: muted, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: ink,
        titleColor: isDark ? "#0f1414" : "#fff",
        bodyColor: isDark ? "#0f1414" : "#fff",
        borderColor: accent,
        borderWidth: 1,
        cornerRadius: 4,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: muted, font: { size: 10 }, maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: grid },
        ticks: { color: muted, font: { size: 10 }, precision: 0 },
      },
    },
  };
}

function buildDoughnutOptions(isDark) {
  const base = buildBaseOptions(isDark);
  const { muted } = chartTheme(isDark);
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: muted, font: { size: 10 }, boxWidth: 10, padding: 10 },
      },
      tooltip: base.plugins.tooltip,
    },
  };
}

function palette(n) {
  const colors = [
    TEAL,
    "#115E59",
    "#059669",
    "#F59E0B",
    "#2563EB",
    "#7C3AED",
    "#EA580C",
    "#DC2626",
  ];
  return Array.from({ length: n }, (_, i) => colors[i % colors.length]);
}

/**
 * Plant-a-tree analytics: charts, AI briefing, downloadable PDF.
 */
const TreeAnalyticsPanel = ({
  projects = [],
  userTrees = [],
  userStats = {},
  className = "",
}) => {
  const reportRef = useRef(null);
  const { isDark } = useTheme();
  const [report, setReport] = useState(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const accent = isDark ? TEAL_DARK : TEAL;
  const baseOptions = useMemo(() => buildBaseOptions(isDark), [isDark]);
  const doughnutOptions = useMemo(() => buildDoughnutOptions(isDark), [isDark]);

  const enrichWithAi = async (baseReport) => {
    setAiLoading(true);
    try {
      const prompt = treeAnalyticsPrompt(baseReport);
      const res = await client.run(
        "post",
        endpoints.ai_generate_content,
        {
          topic: prompt,
          type: "tree_impact_briefing",
        },
        true
      );
      const text =
        res?.full_content ||
        res?.content ||
        res?.generated_content ||
        res?.text ||
        (typeof res === "string" ? res : "");
      if (text && String(text).trim().length > 40) {
        setAiBrief(String(text).trim());
        return;
      }
    } catch {
      // Local narrative fallback.
    } finally {
      setAiLoading(false);
    }
    setAiBrief(baseReport?.narrative || "");
  };

  const load = async () => {
    setLoading(true);
    setError("");
    let stats = {};
    try {
      stats = (await fetchTreeStats()) || {};
    } catch {
      stats = {};
    }
    const local = buildTreeAnalytics({
      projects,
      stats,
      userTrees,
      userStats,
    });
    setReport(local);
    setAiBrief(local.narrative || "");
    setLoading(false);
    enrichWithAi(local);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length, userTrees.length, userStats?.treesPlanted]);

  const charts = report?.charts || {};
  const summary = report?.summary || {};

  const countryData = useMemo(
    () => ({
      labels: charts.by_country?.labels || [],
      datasets: [
        {
          label: "Trees planted",
          data: charts.by_country?.values || [],
          backgroundColor: isDark ? "#1f949a" : "#115E59",
          borderRadius: 4,
        },
      ],
    }),
    [charts.by_country, isDark]
  );

  const typeData = useMemo(
    () => ({
      labels: charts.by_type?.labels || [],
      datasets: [
        {
          data: charts.by_type?.values || [],
          backgroundColor: palette((charts.by_type?.labels || []).length),
          borderWidth: 0,
        },
      ],
    }),
    [charts.by_type]
  );

  const progressData = useMemo(
    () => ({
      labels: charts.progress?.labels || [],
      datasets: [
        {
          label: "Progress %",
          data: charts.progress?.values || [],
          backgroundColor: accent,
          borderRadius: 4,
        },
      ],
    }),
    [charts.progress, accent]
  );

  const orgData = useMemo(
    () => ({
      labels: charts.by_org?.labels || [],
      datasets: [
        {
          data: charts.by_org?.values || [],
          backgroundColor: palette((charts.by_org?.labels || []).length),
          borderWidth: 0,
        },
      ],
    }),
    [charts.by_org]
  );

  const activityData = useMemo(
    () => ({
      labels: charts.my_activity_7d?.labels || [],
      datasets: [
        {
          label: "Your plantings",
          data: charts.my_activity_7d?.values || [],
          borderColor: accent,
          backgroundColor: isDark ? "rgba(43, 184, 191, 0.18)" : "rgba(13, 148, 136, 0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    }),
    [charts.my_activity_7d, accent, isDark]
  );

  const downloadPdf = async () => {
    if (!reportRef.current || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: isDark ? "#171d1d" : "#ffffff",
        logging: false,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(img, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(img, "PNG", margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      pdf.save(`ClimateWavers_Tree_Impact_${stamp}.pdf`);
    } catch (err) {
      console.error(err);
      setError("PDF download failed. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !report) {
    return (
      <section className={`border border-border bg-surface p-4 ${className}`}>
        <p className="text-sm text-muted">Building tree impact pulse…</p>
      </section>
    );
  }

  return (
    <section className={`border border-border bg-surface ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Tree impact pulse</p>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-0.5">
            Reforestation analytics & AI briefing
          </h2>
          <p className="text-sm text-muted mt-1">
            Visualize verified projects, then download a shareable impact report.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={load}
            className="h-10 px-3 border border-border text-sm inline-flex items-center gap-1.5 hover:bg-background text-foreground"
            style={{ borderRadius: 5 }}
          >
            <IoRefreshOutline size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading || !report}
            className="h-10 px-3 bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{ borderRadius: 5 }}
          >
            <IoDownloadOutline size={16} />
            {downloading ? "Preparing…" : "Download report"}
          </button>
        </div>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}

      <div ref={reportRef} className="p-4 space-y-5 bg-surface text-foreground">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {[
            { label: "Network trees", value: (summary.total_trees_planted ?? 0).toLocaleString?.() ?? summary.total_trees_planted },
            { label: "Active projects", value: summary.active_projects ?? 0 },
            { label: "Verified", value: summary.verified_projects ?? 0 },
            {
              label: "Funds raised",
              value: `$${Math.round(summary.total_funds_raised || 0).toLocaleString()}`,
            },
            { label: "Your trees", value: summary.my_trees ?? 0 },
            { label: "Top country", value: summary.top_country || "—" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-border bg-surface-muted p-3 min-w-0"
              style={{ borderRadius: 5 }}
            >
              <p className="text-[11px] sm:text-xs text-muted">{stat.label}</p>
              <p className="text-base sm:text-xl font-semibold text-foreground mt-1 truncate tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="border border-border bg-surface-muted p-4" style={{ borderRadius: 5 }}>
          <div className="flex items-center gap-2 mb-2">
            <IoSparklesOutline size={18} className="text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground">AI canopy briefing</h3>
            {aiLoading ? <span className="text-xs text-muted">Growing insight…</span> : null}
          </div>
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {aiBrief || report?.narrative || "No briefing yet."}
          </p>
          {report?.disclaimer ? (
            <p className="text-xs text-muted mt-3">{report.disclaimer}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border p-3" style={{ borderRadius: 5 }}>
            <h3 className="text-sm font-medium mb-2">Trees by country</h3>
            <div className="h-48">
              {(charts.by_country?.labels || []).length ? (
                <Bar
                  data={countryData}
                  options={{
                    ...baseOptions,
                    indexAxis: "y",
                    scales: {
                      ...baseOptions.scales,
                      x: { ...baseOptions.scales.y, grid: { color: chartTheme(isDark).grid } },
                      y: { ...baseOptions.scales.x, grid: { display: false } },
                    },
                  }}
                />
              ) : (
                <p className="text-sm text-muted">No country data yet.</p>
              )}
            </div>
          </div>
          <div className="border border-border p-3" style={{ borderRadius: 5 }}>
            <h3 className="text-sm font-medium mb-2">Project types</h3>
            <div className="h-48">
              {(charts.by_type?.labels || []).length ? (
                <Doughnut data={typeData} options={doughnutOptions} />
              ) : (
                <p className="text-sm text-muted">No type mix yet.</p>
              )}
            </div>
          </div>
          <div className="border border-border p-3" style={{ borderRadius: 5 }}>
            <h3 className="text-sm font-medium mb-2">Project progress leaders</h3>
            <div className="h-48">
              {(charts.progress?.labels || []).length ? (
                <Bar data={progressData} options={baseOptions} />
              ) : (
                <p className="text-sm text-muted">No progress data yet.</p>
              )}
            </div>
          </div>
          <div className="border border-border p-3" style={{ borderRadius: 5 }}>
            <h3 className="text-sm font-medium mb-2">Your 7-day plantings</h3>
            <div className="h-48">
              <Line data={activityData} options={baseOptions} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-border p-3" style={{ borderRadius: 5 }}>
            <h3 className="text-sm font-medium mb-2">Trees by organization</h3>
            <div className="h-44">
              {(charts.by_org?.labels || []).length ? (
                <Doughnut data={orgData} options={doughnutOptions} />
              ) : (
                <p className="text-sm text-muted">No organization mix yet.</p>
              )}
            </div>
          </div>
          <div className="border border-border p-3 overflow-x-auto" style={{ borderRadius: 5 }}>
            <h3 className="text-sm font-medium mb-2">Progress table</h3>
            {(report?.progress_table || []).length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-border">
                    <th className="py-2 pr-2 font-medium">Project</th>
                    <th className="py-2 pr-2 font-medium">Trees</th>
                    <th className="py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.progress_table.map((row) => (
                    <tr key={row.label} className="border-b border-border/60">
                      <td className="py-2 pr-2">{row.label}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {row.trees}
                        {row.target ? ` / ${row.target}` : ""}
                      </td>
                      <td className="py-2 tabular-nums">{row.value}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">No projects yet.</p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted">
          Generated {report?.generated_at ? new Date(report.generated_at).toLocaleString() : "—"} ·
          Climate Wavers Tree Impact
        </p>
      </div>
    </section>
  );
};

export default TreeAnalyticsPanel;
