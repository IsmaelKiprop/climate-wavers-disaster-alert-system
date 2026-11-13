import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Radar } from "react-chartjs-2";
import {
  IoChevronDown,
  IoChevronUp,
  IoDownloadOutline,
  IoRefreshOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { useLiveDisasters } from "../hooks/useLiveDisasters";
import {
  buildProfileImpactAnalytics,
  profileImpactPrompt,
} from "../utils/profileImpactAnalytics";
import { exportElementToPdf, sanitizeAiBrief } from "../utils/exportPdf";
import { useTheme } from "../context/ThemeContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
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

function palette(n) {
  const colors = [TEAL, "#115E59", "#F59E0B", "#DC2626", "#2563EB", "#059669", "#EA580C"];
  return Array.from({ length: n }, (_, i) => colors[i % colors.length]);
}

function clampPct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/**
 * Unique profile lens: resilience radar + hazard/hope balance + AI briefing.
 * Compact strip by default; expand for charts and AI brief.
 */
const ProfileImpactPanel = ({ profile, feed = {}, className = "" }) => {
  const reportRef = useRef(null);
  const { isDark } = useTheme();
  const live = useLiveDisasters();
  const disasters = Array.isArray(live.data) ? live.data : [];
  const [trees, setTrees] = useState(profile?.trees || {});
  const [report, setReport] = useState(null);
  const [aiBrief, setAiBrief] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const accent = isDark ? TEAL_DARK : TEAL;
  const { muted, ink, grid } = chartTheme(isDark);

  useEffect(() => {
    let alive = true;
    const id = profile?.id;
    if (!id) return undefined;
    client
      .run("get", `${endpoints.users}${id}/public/`, {}, false)
      .then((data) => {
        if (alive && data?.trees) setTrees(data.trees);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  const enrichWithAi = async (base) => {
    setAiLoading(true);
    try {
      const res = await client.run(
        "post",
        endpoints.ai_generate_content,
        { topic: profileImpactPrompt(base), type: "profile_impact_briefing" },
        true
      );
      const text =
        res?.full_content ||
        res?.content ||
        res?.generated_content ||
        (typeof res === "string" ? res : "");
      const cleaned = sanitizeAiBrief(text, base?.narrative || "");
      if (cleaned && cleaned.length > 40) {
        setAiBrief(cleaned);
        return;
      }
    } catch {
      // local narrative
    } finally {
      setAiLoading(false);
    }
    setAiBrief(base?.narrative || "");
  };

  const load = async () => {
    setLoading(true);
    setError("");
    const local = buildProfileImpactAnalytics({
      profile,
      feed,
      disasters,
      trees,
    });
    setReport(local);
    setAiBrief(local.narrative || "");
    setLoading(false);
    enrichWithAi(local);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile?.id,
    disasters.length,
    feed?.post?.length,
    feed?.comments?.length,
    feed?.likes?.length,
    trees?.trees_total,
  ]);

  const summary = report?.summary || {};
  const resilience = summary.resilience_index ?? 0;

  const compactStats = [
    { label: "Trees", value: summary.trees_total ?? 0 },
    { label: "Posts", value: summary.posts ?? 0 },
    { label: "Nearby", value: summary.nearby_signals ?? 0 },
    { label: "High / critical", value: summary.high_nearby ?? 0 },
  ];

  const radarData = useMemo(
    () => ({
      labels: report?.radar?.labels || [],
      datasets: [
        {
          label: "Impact",
          data: report?.radar?.values || [],
          backgroundColor: isDark ? "rgba(43, 184, 191, 0.22)" : "rgba(13, 148, 136, 0.18)",
          borderColor: accent,
          pointBackgroundColor: accent,
          pointBorderColor: isDark ? "#171d1d" : "#fff",
          borderWidth: 2,
        },
      ],
    }),
    [report?.radar, accent, isDark]
  );

  const radarOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ink,
          titleColor: isDark ? "#0f1414" : "#fff",
          bodyColor: isDark ? "#0f1414" : "#fff",
          borderColor: accent,
          borderWidth: 1,
        },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, backdropColor: "transparent" },
          grid: { color: grid },
          angleLines: { color: grid },
          pointLabels: { color: muted, font: { size: 11 } },
        },
      },
    }),
    [ink, isDark, accent, grid, muted]
  );

  const balanceData = useMemo(
    () => ({
      labels: report?.balance?.labels || [],
      datasets: [
        {
          data: report?.balance?.values || [],
          backgroundColor: [isDark ? "#b45309" : "#D97706", accent],
          borderRadius: 4,
        },
      ],
    }),
    [report?.balance, accent, isDark]
  );

  const hazardData = useMemo(
    () => ({
      labels: report?.hazard_mix?.labels || [],
      datasets: [
        {
          data: report?.hazard_mix?.values || [],
          backgroundColor: palette((report?.hazard_mix?.labels || []).length),
          borderWidth: 0,
        },
      ],
    }),
    [report?.hazard_mix]
  );

  const waitForPaint = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 120);
        });
      });
    });

  const downloadPdf = async () => {
    if (downloading || !report) return;
    setDownloading(true);
    const wasExpanded = expanded;
    try {
      if (!wasExpanded) {
        setExpanded(true);
        await waitForPaint();
      }
      if (!reportRef.current) {
        setError("PDF download failed. Try again.");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const safeName = String(summary.name || "Profile")
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 40);
      await exportElementToPdf(reportRef.current, {
        fileName: `ClimateWavers_Impact_${safeName}_${stamp}.pdf`,
        backgroundColor: isDark ? "#171d1d" : "#ffffff",
        captureWidth: 920,
      });
    } catch (err) {
      console.error(err);
      setError("PDF download failed. Try again.");
    } finally {
      if (!wasExpanded) setExpanded(false);
      setDownloading(false);
    }
  };

  if (loading && !report) {
    return (
      <section className={`border border-border bg-surface p-4 ${className}`} style={{ borderRadius: 5 }}>
        <p className="text-sm text-muted">Mapping impact constellation…</p>
      </section>
    );
  }

  return (
    <section
      className={`border border-border bg-surface ${className}`}
      style={{ borderRadius: 5 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Impact constellation</p>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-0.5">
            Resilience lens · disasters × personal action
          </h2>
          <p className="text-sm text-muted mt-1">
            Live hazard pressure weighed against this member’s canopy and voice.
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
            {downloading ? "Preparing…" : "Download"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="h-10 px-3 border border-border text-sm inline-flex items-center gap-1.5 hover:bg-background text-foreground"
            style={{ borderRadius: 5 }}
          >
            {expanded ? <IoChevronUp size={16} /> : <IoChevronDown size={16} />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}

      <div ref={reportRef} className="p-4 sm:p-5 space-y-4 bg-surface text-foreground">
        {/* Compact strip: always visible */}
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-stretch">
          <div
            className="border border-border bg-surface-muted px-3 py-3 flex flex-col items-center justify-center text-center"
            style={{ borderRadius: 5, breakInside: "avoid" }}
          >
            <p className="text-[11px] uppercase tracking-wide text-muted">Resilience</p>
            <p
              className="mt-1 text-4xl font-semibold tabular-nums leading-none"
              style={{ color: accent }}
            >
              {resilience}
            </p>
            <p className="text-[11px] text-muted mt-1">of 100</p>
            <div
              className="mt-2 w-full h-1.5 bg-background border border-border overflow-hidden"
              style={{ borderRadius: 5 }}
            >
              <div
                className="h-full"
                style={{ width: `${clampPct(resilience)}%`, background: accent }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {compactStats.map((stat) => (
              <div
                key={stat.label}
                className="border border-border bg-surface-muted px-3 py-2.5 min-w-0"
                style={{ borderRadius: 5, breakInside: "avoid" }}
              >
                <p className="text-[11px] text-muted truncate">{stat.label}</p>
                <p className="text-base sm:text-lg font-semibold mt-0.5 truncate tabular-nums">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {expanded ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Trees (ledger)", value: summary.trees_total ?? 0 },
                { label: "Posts", value: summary.posts ?? 0 },
                { label: "Nearby signals", value: summary.nearby_signals ?? 0 },
                { label: "High / critical", value: summary.high_nearby ?? 0 },
                { label: "Climate feed %", value: `${summary.climate_share_pct ?? 0}%` },
                { label: "Watch place", value: summary.place || "—" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="border border-border bg-surface-muted p-3 min-w-0"
                  style={{ borderRadius: 5, breakInside: "avoid" }}
                >
                  <p className="text-[11px] text-muted">{stat.label}</p>
                  <p className="text-base sm:text-lg font-semibold mt-1 truncate tabular-nums">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="border border-border bg-surface-muted p-4"
              style={{ borderRadius: 5, breakInside: "avoid" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <IoSparklesOutline size={18} className="text-primary shrink-0" />
                <h3 className="text-sm font-semibold">AI impact briefing</h3>
                {aiLoading ? <span className="text-xs text-muted">Tuning lens…</span> : null}
              </div>
              <p className="text-sm whitespace-pre-line leading-relaxed">
                {aiBrief || report?.narrative || "No briefing yet."}
              </p>
              {report?.disclaimer ? (
                <p className="text-xs text-foreground/70 mt-3">{report.disclaimer}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className="border border-border p-3"
                style={{ borderRadius: 5, breakInside: "avoid" }}
              >
                <h3 className="text-sm font-medium mb-2">Resilience radar</h3>
                <div className="h-56">
                  {(report?.radar?.labels || []).length ? (
                    <Radar data={radarData} options={radarOptions} />
                  ) : (
                    <p className="text-sm text-muted">Not enough signal yet.</p>
                  )}
                </div>
              </div>
              <div
                className="border border-border p-3"
                style={{ borderRadius: 5, breakInside: "avoid" }}
              >
                <h3 className="text-sm font-medium mb-2">Hazard pressure vs canopy</h3>
                <div className="h-56">
                  <Bar
                    data={balanceData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { ticks: { color: muted }, grid: { display: false } },
                        y: {
                          beginAtZero: true,
                          max: 100,
                          ticks: { color: muted },
                          grid: { color: grid },
                        },
                      },
                    }}
                  />
                </div>
              </div>
              <div
                className="border border-border p-3 md:col-span-2"
                style={{ borderRadius: 5, breakInside: "avoid" }}
              >
                <h3 className="text-sm font-medium mb-2">
                  Hazard mix {summary.place ? `· ${summary.place}` : "· live field"}
                </h3>
                <div className="h-52 max-w-md mx-auto">
                  {(report?.hazard_mix?.labels || []).length ? (
                    <Doughnut
                      data={hazardData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: "bottom",
                            labels: { color: muted, boxWidth: 10, font: { size: 10 } },
                          },
                        },
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted">No hazard clusters in this watch window.</p>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-foreground/70">
              Generated {report?.generated_at ? new Date(report.generated_at).toLocaleString() : "—"}{" "}
              · Climate Wavers Impact Constellation
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">
            Expand for AI briefing, resilience radar, and hazard mix.
          </p>
        )}
      </div>
    </section>
  );
};

export default ProfileImpactPanel;
