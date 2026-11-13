import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  IoCloudyOutline,
  IoLocateOutline,
  IoRainyOutline,
  IoRefreshOutline,
  IoSnowOutline,
  IoSunnyOutline,
  IoThunderstormOutline,
  IoWaterOutline,
} from "react-icons/io5";
import { WiFog, WiDayCloudy } from "react-icons/wi";
import { useTheme } from "../context/ThemeContext";
import { DEFAULT_LOCATION, resolveUserLocation } from "../utils/location";
import { fetchWeatherForecast } from "../utils/weatherForecast";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
);

const TEAL = "#0D9488";
const TEAL_DARK = "#2bb8bf";

function WeatherGlyph({ hint, className = "w-7 h-7" }) {
  const props = { className, "aria-hidden": true };
  switch (hint) {
    case "sun":
      return <IoSunnyOutline {...props} />;
    case "cloud-sun":
      return <WiDayCloudy {...props} className={`${className} w-8 h-8`} />;
    case "fog":
      return <WiFog {...props} className={`${className} w-8 h-8`} />;
    case "drizzle":
    case "rain":
      return <IoRainyOutline {...props} />;
    case "snow":
      return <IoSnowOutline {...props} />;
    case "storm":
      return <IoThunderstormOutline {...props} />;
    default:
      return <IoCloudyOutline {...props} />;
  }
}

function toneClasses(tone) {
  switch (tone) {
    case "clear":
      return "bg-warning/10 text-warning border-warning/30";
    case "rain":
      return "bg-primary/10 text-primary border-primary/30";
    case "storm":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "snow":
      return "bg-primary/5 text-foreground border-primary/20";
    case "fog":
      return "bg-surface-muted text-muted border-border";
    default:
      return "bg-surface-muted text-foreground border-border";
  }
}

function SkeletonBlock() {
  return (
    <section className="border border-border bg-surface p-4 space-y-4" aria-busy="true">
      <div className="h-4 w-28 bg-surface-muted" style={{ borderRadius: 5 }} />
      <div className="h-8 w-48 bg-surface-muted" style={{ borderRadius: 5 }} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface-muted" style={{ borderRadius: 5 }} />
        ))}
      </div>
      <div className="h-36 bg-surface-muted" style={{ borderRadius: 5 }} />
    </section>
  );
}

/**
 * Live local weather + 7-day outlook for the dashboard.
 * @param {{ compact?: boolean, className?: string }} props
 */
const WeatherForecastPanel = ({ compact = false, className = "" }) => {
  const { isDark } = useTheme();
  const accent = isDark ? TEAL_DARK : TEAL;
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  const load = useCallback(async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError("");
    try {
      const coords = await resolveUserLocation({ forceRefresh });
      const report = await fetchWeatherForecast({
        latitude: coords.latitude,
        longitude: coords.longitude,
        label:
          forceRefresh
            ? null
            : coords.label || (coords.source === "default" ? DEFAULT_LOCATION.label : null),
        refreshPlaceLabel: forceRefresh,
      });
      setForecast(report);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Could not load weather forecast.");
    } finally {
      setLoading(false);
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const useMyLocation = async () => {
    setLocating(true);
    await load({ forceRefresh: true });
  };

  const chartOptions = useMemo(() => {
    const muted = isDark ? "#9ca3af" : "#6B7280";
    const ink = isDark ? "#f3f5f5" : "#111827";
    const grid = isDark ? "#2d3737" : "#E5E7EB";
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: ink,
          titleColor: isDark ? "#0f1414" : "#fff",
          bodyColor: isDark ? "#0f1414" : "#fff",
          borderColor: accent,
          borderWidth: 1,
          cornerRadius: 4,
          callbacks: {
            label: (ctx) =>
              ctx.dataset.yAxisID === "y1"
                ? ` Rain chance ${ctx.parsed.y}%`
                : ` ${ctx.parsed.y}°`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: muted,
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: compact ? 6 : 8,
          },
        },
        y: {
          position: "left",
          grid: { color: grid },
          ticks: {
            color: muted,
            font: { size: 10 },
            callback: (v) => `${v}°`,
          },
        },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          grid: { display: false },
          ticks: {
            color: muted,
            font: { size: 10 },
            callback: (v) => `${v}%`,
            maxTicksLimit: 5,
          },
        },
      },
    };
  }, [accent, compact, isDark]);

  const chartData = useMemo(() => {
    if (!forecast?.chart) return null;
    return {
      labels: forecast.chart.labels,
      datasets: [
        {
          label: "Temp",
          data: forecast.chart.temps,
          borderColor: accent,
          backgroundColor: isDark ? "rgba(43,184,191,0.12)" : "rgba(13,148,136,0.12)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Rain %",
          data: forecast.chart.precipProb,
          borderColor: isDark ? "#9ca3af" : "#6B7280",
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          yAxisID: "y1",
        },
      ],
    };
  }, [accent, forecast, isDark]);

  if (loading && !forecast) {
    return (
      <div className={className}>
        <SkeletonBlock />
      </div>
    );
  }

  if (!forecast) {
    return (
      <section className={`border border-border bg-surface p-4 ${className}`}>
        <p className="text-sm text-destructive">
          {error || "Weather forecast is unavailable."}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="mt-3 h-10 px-3 border border-border text-sm inline-flex items-center gap-1.5 hover:bg-background"
          style={{ borderRadius: 5 }}
        >
          <IoRefreshOutline size={16} />
          Try again
        </button>
      </section>
    );
  }

  const { current, hourly, daily, location, units, today } = forecast;
  const days = compact ? daily.slice(0, 5) : daily;

  return (
    <section className={`border border-border bg-surface overflow-hidden ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Local forecast</p>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground mt-0.5">
            Weather outlook
          </h2>
          <p className="text-sm text-muted mt-1 truncate" title={location.label}>
            {location.label}
            <span className="text-muted"> · {forecast.source}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating || loading}
            className="h-10 px-3 border border-border text-sm inline-flex items-center gap-1.5 hover:bg-background disabled:opacity-60"
            style={{ borderRadius: 5 }}
            aria-label="Use my location"
          >
            <IoLocateOutline size={16} />
            {locating ? "Locating…" : "My location"}
          </button>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="h-10 px-3 bg-primary text-primary-foreground text-sm inline-flex items-center gap-1.5 disabled:opacity-60"
            style={{ borderRadius: 5 }}
          >
            <IoRefreshOutline size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}

      <div className="p-4 space-y-5">
        {/* Now strip: one composition, not a card stack */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 md:gap-6 items-stretch">
          <div
            className={`border p-4 sm:p-5 flex flex-col justify-between min-h-[168px] ${toneClasses(current.tone)}`}
            style={{ borderRadius: 5 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">Right now</p>
                <p className="text-sm font-medium mt-1">{current.label}</p>
              </div>
              <WeatherGlyph hint={current.IconHint} className="w-9 h-9 shrink-0 opacity-90" />
            </div>
            <div className="mt-4 flex items-end gap-2 flex-wrap">
              <span className="text-5xl sm:text-6xl font-semibold tabular-nums leading-none tracking-tight">
                {current.temp}°
              </span>
              <span className="text-sm opacity-80 pb-1.5">
                Feels like {current.feelsLike}°
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 content-stretch">
            {[
              {
                label: "Humidity",
                value: current.humidity != null ? `${current.humidity}%` : "—",
                icon: <IoWaterOutline className="w-4 h-4 text-primary" aria-hidden />,
              },
              {
                label: "Wind",
                value: `${current.wind} ${units.wind}`,
                icon: <IoCloudyOutline className="w-4 h-4 text-muted" aria-hidden />,
              },
              {
                label: "Cloud cover",
                value: current.cloudCover != null ? `${current.cloudCover}%` : "—",
                icon: <WiDayCloudy className="w-5 h-5 text-muted" aria-hidden />,
              },
              {
                label: "Precip now",
                value: `${Number(current.precip || 0).toFixed(1)} ${units.precip}`,
                icon: <IoRainyOutline className="w-4 h-4 text-primary" aria-hidden />,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="border border-border bg-surface-muted p-3 flex flex-col justify-between min-h-[76px]"
                style={{ borderRadius: 5 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] sm:text-xs text-muted">{stat.label}</p>
                  {stat.icon}
                </div>
                <p className="text-base sm:text-lg font-semibold text-foreground mt-2 tabular-nums">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Daily fields from Open-Meteo (high/low/rain) were underused before */}
        {today ? (
          <div
            className={`border p-3 sm:p-4 ${toneClasses(today.tone)}`}
            style={{ borderRadius: 5 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide opacity-80">Today&apos;s outlook</p>
                <p className="text-sm sm:text-base font-medium mt-1">{today.condition}</p>
              </div>
              <WeatherGlyph hint={today.IconHint} className="w-7 h-7 shrink-0 opacity-90" />
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <p className="text-[11px] opacity-80">High / low</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">
                  {today.high}° / {today.low}°
                </p>
              </div>
              <div>
                <p className="text-[11px] opacity-80">Rain chance</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{today.precipProb}%</p>
              </div>
              <div>
                <p className="text-[11px] opacity-80">Expected rain</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">
                  {today.precipSum.toFixed(1)} {units.precip}
                </p>
              </div>
              <div>
                <p className="text-[11px] opacity-80">UV index</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">
                  {today.uv != null ? Number(today.uv).toFixed(1) : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Hourly strip */}
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2 px-0.5">
            <h3 className="text-sm font-medium text-foreground">Next 24 hours</h3>
            <p className="text-[11px] text-muted hidden sm:block">Swipe on mobile</p>
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
            style={{ scrollbarWidth: "thin" }}
            role="list"
            aria-label="Hourly forecast"
          >
            {hourly.map((h) => (
              <div
                key={h.time}
                role="listitem"
                className="shrink-0 w-[72px] sm:w-[78px] border border-border bg-background px-2 py-3 text-center"
                style={{ borderRadius: 5 }}
              >
                <p className="text-[11px] text-muted truncate">{h.label}</p>
                <div className="my-2 flex justify-center text-foreground">
                  <WeatherGlyph hint={h.IconHint} className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold tabular-nums text-foreground">{h.temp}°</p>
                <p className="text-[10px] text-primary mt-1 tabular-nums">{h.precipProb}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Temp + rain chance chart */}
        {chartData ? (
          <div className="border border-border p-3">
            <h3 className="text-sm font-medium text-foreground mb-2">
              Temperature and rain chance
            </h3>
            <div className={compact ? "h-40 sm:h-44" : "h-44 sm:h-52"}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        ) : null}

        {/* Multi-day outlook */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 px-0.5">
            {compact ? "5-day outlook" : "7-day outlook"}
          </h3>
          <ul className="border border-border divide-y divide-border">
            {days.map((d) => {
              const precipWidth = Math.min(100, Math.max(4, d.precipProb || 0));
              return (
                <li
                  key={d.time}
                  className="grid grid-cols-[4.25rem_1.75rem_minmax(0,1fr)_auto] sm:grid-cols-[5.5rem_2rem_minmax(0,1fr)_auto] gap-2 sm:gap-3 items-center px-3 py-2.5"
                >
                  <span className="text-sm font-medium text-foreground">{d.label}</span>
                  <span className="flex justify-center text-foreground">
                    <WeatherGlyph hint={d.IconHint} className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted truncate">{d.condition}</p>
                    <div
                      className="mt-1.5 h-1.5 bg-surface-muted overflow-hidden"
                      style={{ borderRadius: 5 }}
                    >
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${precipWidth}%`, borderRadius: 5 }}
                        title={`Rain chance ${d.precipProb}%`}
                      />
                    </div>
                    <p className="text-[10px] text-muted mt-1 tabular-nums">
                      {d.precipProb}% · {d.precipSum.toFixed(1)} {units.precip}
                    </p>
                  </div>
                  <div className="text-right tabular-nums shrink-0 pl-1">
                    <p className="text-sm font-semibold text-foreground">{d.high}°</p>
                    <p className="text-xs text-muted">{d.low}°</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {!compact && today ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                label: "Max wind",
                value:
                  today.windMax != null
                    ? `${Math.round(today.windMax)} ${units.wind}`
                    : "—",
              },
              {
                label: "Sunrise",
                value: today.sunriseLabel || "—",
              },
              {
                label: "Sunset",
                value: today.sunsetLabel || "—",
              },
              {
                label: "Timezone",
                value: location.timezone || "local",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="border border-border bg-surface-muted p-3"
                style={{ borderRadius: 5 }}
              >
                <p className="text-[11px] text-muted">{item.label}</p>
                <p className="text-sm font-semibold text-foreground mt-1 tabular-nums truncate">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <p className="text-[11px] text-muted px-0.5">
          Updated{" "}
          {forecast.generatedAt
            ? new Date(forecast.generatedAt).toLocaleString()
            : "just now"}
          . Forecast data from Open-Meteo.
        </p>
      </div>
    </section>
  );
};

export default WeatherForecastPanel;
