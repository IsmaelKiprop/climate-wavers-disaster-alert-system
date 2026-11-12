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
import { IoDownloadOutline, IoRefreshOutline } from "react-icons/io5";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { buildClientForecast } from "../utils/disasterForecastClient";
import { exportElementToPdf } from "../utils/exportPdf";
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
    "#F59E0B",
    "#DC2626",
    "#2563EB",
    "#7C3AED",
    "#059669",
    "#EA580C",
  ];
  return Array.from({ length: n }, (_, i) => colors[i % colors.length]);
}

/**
 * @param {{ events?: array, compact?: boolean, className?: string }} props
 */
const DisasterForecastPanel = ({ events = [], compact = false, className = "" }) => {
  const reportRef = useRef(null);
  const { isDark } = useTheme();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const accent = isDark ? TEAL_DARK : TEAL;
  const baseOptions = useMemo(() => buildBaseOptions(isDark), [isDark]);
  const doughnutOptions = useMemo(() => buildDoughnutOptions(isDark), [isDark]);

  const load = async () => {
    setLoading(true);
    setError("");
    const local = buildClientForecast(events, 90);
    setReport(local);
    try {
      const remote = await client.run(
        "post",
        `${endpoints.disasters}forecast/`,
        { events: events.slice(0, 250), days: 90 },
        true
      );
      if (remote?.charts && remote?.summary) {
        setReport(remote);
      }
    } catch (err) {
      // Keep client forecast; surface soft notice only if empty.
      if (!local?.summary?.events_analyzed) {
        setError("Could not load forecast yet.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  const charts = report?.charts || {};
  const summary = report?.summary || {};

  const activityData = useMemo(
    () => ({
      labels: charts.daily_activity?.labels || [],
      datasets: [
        {
          label: "Events",
          data: charts.daily_activity?.values || [],
          borderColor: accent,
          backgroundColor: isDark ? "rgba(43, 184, 191, 0.18)" : "rgba(13, 148, 136, 0.12)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    }),
    [charts.daily_activity, accent, isDark]
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

  const outlookData = useMemo(
    () => ({
      labels: charts.outlook_by_type?.labels || [],
      datasets: [
        {
          label: "Projected next 7 days",
          data: charts.outlook_by_type?.values || [],
          backgroundColor: accent,
          borderRadius: 4,
        },
      ],
    }),
    [charts.outlook_by_type, accent]
  );

  const countryData = useMemo(
    () => ({
      labels: charts.by_country?.labels || [],
      datasets: [
        {
          label: "Events",
          data: charts.by_country?.values || [],
          backgroundColor: isDark ? "#1f949a" : "#115E59",
          borderRadius: 4,
        },
      ],
    }),
    [charts.by_country, isDark]
  );

  const downloadPdf = async () => {
    if (!reportRef.current || downloading) return;
    setDownloading(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await exportElementToPdf(reportRef.current, {
        fileName: `ClimateWavers_Disaster_Outlook_${stamp}.pdf`,
        backgroundColor: isDark ? "#171d1d" : "#ffffff",
        captureWidth: 920,
      });
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
        <p className="text-sm text-muted">Building disaster outlook…</p>
      </section>
    );
  }

  return (
    <section className={`border border-border bg-surface ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">WaverX outlook</p>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-0.5">
            Future prediction from historical disasters
          </h2>
          <p className="text-sm text-muted mt-1">
            AI-assisted analysis of live USGS/NASA signals and stored history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={load}
            className="h-10 px-3 border border-border text-sm inline-flex items-center gap-1.5 hover:bg-background"
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
            {downloading ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}

      <div ref={reportRef} className="p-4 space-y-5 bg-surface text-foreground">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: "Analyzed", value: summary.events_analyzed ?? 0 },
            { label: "Last 7 days", value: summary.last_7_days ?? 0 },
            { label: "Next 7 days*", value: summary.projected_next_7_days ?? 0 },
            { label: "Next 14 days*", value: summary.projected_next_14_days ?? 0 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-border bg-surface-muted p-3"
              style={{ borderRadius: 5 }}
            >
              <p className="text-[11px] sm:text-xs text-muted">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-semibold text-foreground mt-1 tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className={`grid gap-4 ${compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
          <div className="border border-border p-3">
            <h3 className="text-sm font-medium text-foreground mb-2">14-day activity</h3>
            <div className="h-44 sm:h-52">
              <Line data={activityData} options={baseOptions} />
            </div>
          </div>
          <div className="border border-border p-3">
            <h3 className="text-sm font-medium text-foreground mb-2">By disaster type</h3>
            <div className="h-44 sm:h-52">
              <Doughnut data={typeData} options={doughnutOptions} />
            </div>
          </div>
          {!compact ? (
            <>
              <div className="border border-border p-3">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Projected events next 7 days
                </h3>
                <div className="h-44 sm:h-52">
                  <Bar data={outlookData} options={baseOptions} />
                </div>
              </div>
              <div className="border border-border p-3">
                <h3 className="text-sm font-medium text-foreground mb-2">Hotspot regions</h3>
                <div className="h-44 sm:h-52">
                  <Bar
                    data={countryData}
                    options={{
                      ...baseOptions,
                      indexAxis: "y",
                    }}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>

        {!compact && Array.isArray(report?.type_outlook) && report.type_outlook.length > 0 ? (
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-background text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">History</th>
                  <th className="px-3 py-2 font-medium">Share</th>
                  <th className="px-3 py-2 font-medium">Next 7d</th>
                  <th className="px-3 py-2 font-medium">Trend</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {report.type_outlook.map((row) => (
                  <tr key={row.type} className="border-t border-border">
                    <td className="px-3 py-2 capitalize font-medium text-foreground">{row.type}</td>
                    <td className="px-3 py-2 tabular-nums text-foreground">{row.historical_count}</td>
                    <td className="px-3 py-2 tabular-nums text-foreground">{row.share_pct}%</td>
                    <td className="px-3 py-2 tabular-nums text-foreground">{row.projected_next_7_days}</td>
                    <td className="px-3 py-2 capitalize text-foreground">{row.trend}</td>
                    <td className="px-3 py-2 capitalize text-foreground">{row.risk_band}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="border border-border p-3 sm:p-4">
          <h3 className="text-sm font-medium text-foreground">AI analysis</h3>
          <p className="mt-2 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {report?.narrative || "Not enough history yet to write an outlook."}
          </p>
          <p className="mt-3 text-xs text-muted">{report?.disclaimer}</p>
          <p className="mt-1 text-[11px] text-muted">
            * Projections assume recent pacing continues. Generated{" "}
            {report?.generated_at
              ? new Date(report.generated_at).toLocaleString()
              : "just now"}
            .
          </p>
        </div>
      </div>
    </section>
  );
};

export default DisasterForecastPanel;
