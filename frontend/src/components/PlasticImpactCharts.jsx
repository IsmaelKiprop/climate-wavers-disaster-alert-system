import { useMemo } from "react";
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
const COLORS = [
  "#0D9488",
  "#0369a1",
  "#ca8a04",
  "#c2410c",
  "#7c3aed",
  "#be123c",
  "#059669",
  "#4b5563",
];

function chartTheme(isDark) {
  const muted = isDark ? "#9ca3af" : "#6B7280";
  const ink = isDark ? "#f3f5f5" : "#111827";
  const grid = isDark ? "#2d3737" : "#E5E7EB";
  const accent = isDark ? TEAL_DARK : TEAL;
  return { muted, ink, grid, accent };
}

function baseOptions(isDark) {
  const { muted, ink, grid, accent } = chartTheme(isDark);
  return {
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

function doughnutOptions(isDark) {
  const { muted } = chartTheme(isDark);
  const base = baseOptions(isDark);
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

function statusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Impact charts for public /plastic/:id — uses project.impact payload.
 */
export default function PlasticImpactCharts({ impact }) {
  const { isDark } = useTheme() || {};
  const dark = Boolean(isDark);

  const charts = useMemo(() => {
    if (!impact) return null;
    const accent = dark ? TEAL_DARK : TEAL;
    const recovered = Number(impact.recovered_kg || 0);
    const remaining = Number(impact.remaining_kg || 0);

    const progressData = {
      labels: ["Recovered", "Remaining"],
      datasets: [
        {
          data: [recovered, Math.max(remaining, 0)],
          backgroundColor: [accent, dark ? "#374151" : "#E5E7EB"],
          borderWidth: 0,
        },
      ],
    };

    const polymers = impact.polymer_breakdown || [];
    const polymerData = {
      labels: polymers.map((p) => p.polymer || "mixed"),
      datasets: [
        {
          data: polymers.map((p) => Number(p.kg || 0)),
          backgroundColor: polymers.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 0,
        },
      ],
    };

    const statuses = impact.status_breakdown || [];
    const statusData = {
      labels: statuses.map((s) => statusLabel(s.status)),
      datasets: [
        {
          label: "kg",
          data: statuses.map((s) => Number(s.kg || 0)),
          backgroundColor: accent,
          borderRadius: 2,
        },
      ],
    };

    const hotspots = impact.hotspot_status || [];
    const hotspotData = {
      labels: hotspots.map((h) => statusLabel(h.status)),
      datasets: [
        {
          data: hotspots.map((h) => Number(h.count || 0)),
          backgroundColor: hotspots.map((_, i) => COLORS[i % COLORS.length]),
          borderWidth: 0,
        },
      ],
    };

    const weekly = impact.weekly_kg || [];
    const weeklyData = {
      labels: weekly.map((w) => w.label || w.week),
      datasets: [
        {
          label: "kg",
          data: weekly.map((w) => Number(w.kg || 0)),
          borderColor: accent,
          backgroundColor: dark ? "rgba(43,184,191,0.18)" : "rgba(13,148,136,0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    };

    return { progressData, polymerData, statusData, hotspotData, weeklyData };
  }, [impact, dark]);

  if (!impact || !charts) return null;

  const barOpts = baseOptions(dark);
  const lineOpts = {
    ...baseOptions(dark),
    plugins: {
      ...baseOptions(dark).plugins,
      legend: { display: false },
    },
  };
  const doughnutOpts = doughnutOptions(dark);

  const hasPolymer = (impact.polymer_breakdown || []).some((p) => Number(p.kg) > 0);
  const hasStatus = (impact.status_breakdown || []).some((s) => Number(s.kg) > 0);
  const hasHotspots = (impact.hotspot_status || []).some((h) => Number(h.count) > 0);
  const hasWeekly = (impact.weekly_kg || []).some((w) => Number(w.kg) > 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium text-foreground">Impact</h2>
        <p className="text-sm text-muted mt-0.5">
          Live recovery, sponsorship, and hotspot progress for this Plastic Pulse project.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Recovered" value={`${Number(impact.recovered_kg || 0).toLocaleString()} kg`} />
        <Stat label="Sponsored" value={`${Number(impact.sponsored_kg || 0).toLocaleString()} kg`} />
        <Stat label="Certificates" value={String(impact.certificate_count || 0)} />
        <Stat label="Hotspots" value={String(impact.hotspot_count || 0)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <ChartCard title="Goal progress">
          <Doughnut data={charts.progressData} options={doughnutOpts} />
          <p className="text-[11px] text-muted text-center mt-2">
            {Number(impact.progress_percentage || 0).toFixed(0)}% of{" "}
            {Number(impact.goal_kg || 0).toLocaleString()} kg goal
          </p>
        </ChartCard>

        {hasPolymer ? (
          <ChartCard title="Polymer mix">
            <Doughnut data={charts.polymerData} options={doughnutOpts} />
          </ChartCard>
        ) : (
          <ChartCard title="Polymer mix">
            <EmptyChart note="Recoveries will fill polymer mix" />
          </ChartCard>
        )}

        {hasStatus ? (
          <ChartCard title="Recovery pipeline">
            <Bar data={charts.statusData} options={barOpts} />
          </ChartCard>
        ) : (
          <ChartCard title="Recovery pipeline">
            <EmptyChart note="No recovery pipeline data yet" />
          </ChartCard>
        )}

        {hasHotspots ? (
          <ChartCard title="Hotspot status">
            <Doughnut data={charts.hotspotData} options={doughnutOpts} />
            {impact.drain_hotspots_open > 0 ? (
              <p className="text-[11px] text-muted text-center mt-2">
                {impact.drain_hotspots_open} drain/flood hotspot
                {impact.drain_hotspots_open === 1 ? "" : "s"} still open
              </p>
            ) : null}
          </ChartCard>
        ) : (
          <ChartCard title="Hotspot status">
            <EmptyChart note="No hotspots mapped yet" />
          </ChartCard>
        )}
      </div>

      <ChartCard title="Weekly recovery (12 weeks)" tall>
        {hasWeekly ? (
          <Line data={charts.weeklyData} options={lineOpts} />
        ) : (
          <EmptyChart note="Weekly kg appears as recoveries are verified" />
        )}
      </ChartCard>

      {(impact.recent_sponsors || []).length > 0 ? (
        <div className="border border-border p-4 space-y-2">
          <h3 className="text-sm font-medium text-foreground">Recent sponsors</h3>
          <ul className="space-y-1.5">
            {impact.recent_sponsors.map((s, i) => (
              <li
                key={`${s.name}-${i}`}
                className="flex justify-between gap-2 text-sm text-foreground"
              >
                <span className="truncate">{s.name}</span>
                <span className="text-muted shrink-0">{Number(s.kg || 0)} kg</span>
              </li>
            ))}
          </ul>
          {Number(impact.sponsor_usd || 0) > 0 ? (
            <p className="text-[11px] text-muted pt-1">
              ${Number(impact.sponsor_usd || 0).toLocaleString()} USD sponsored ·{" "}
              {impact.sponsor_count} gift{impact.sponsor_count === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function ChartCard({ title, children, tall }) {
  return (
    <div className="border border-border p-3 sm:p-4">
      <h3 className="text-sm font-medium text-foreground mb-2">{title}</h3>
      <div className={tall ? "h-56" : "h-44"}>{children}</div>
    </div>
  );
}

function EmptyChart({ note }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted px-4 text-center">
      {note}
    </div>
  );
}
