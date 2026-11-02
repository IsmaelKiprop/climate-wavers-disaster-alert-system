import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Bar, Pie, Doughnut } from "react-chartjs-2";
import { formatTimeAgo } from "../utils/apiData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: {
        usePointStyle: true,
        padding: 12,
        font: { size: 11, weight: "500" },
      },
    },
    tooltip: {
      backgroundColor: "#111111",
      titleColor: "#ffffff",
      bodyColor: "#ffffff",
      borderColor: "#067d83",
      borderWidth: 1,
      cornerRadius: 5,
      displayColors: true,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: "#e5e7eb" },
      ticks: { color: "#6b7280", font: { size: 11 } },
    },
    x: {
      grid: { display: false },
      ticks: { color: "#6b7280", font: { size: 11 }, maxRotation: 0 },
    },
  },
};

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        usePointStyle: true,
        padding: 12,
        font: { size: 11, weight: "500" },
      },
    },
    tooltip: {
      backgroundColor: "#111111",
      titleColor: "#ffffff",
      bodyColor: "#ffffff",
      borderColor: "#067d83",
      borderWidth: 1,
      cornerRadius: 5,
    },
  },
};

export default function LandingCharts({ liveCharts, allDisasters, recentEvents }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-surface border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold">Active events by type</h3>
            <span className="text-xs text-primary shrink-0">Live</span>
          </div>
          <div className="h-52 sm:h-64">
            {liveCharts.typeChart.labels.length ? (
              <Bar data={liveCharts.typeChart} options={chartOptions} />
            ) : (
              <p className="text-sm text-muted">Waiting for live events.</p>
            )}
          </div>
        </div>
        <div className="bg-surface border border-border p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">Events by region</h3>
          <div className="h-52 sm:h-64">
            {liveCharts.regionChart.labels.length ? (
              <Pie data={liveCharts.regionChart} options={pieOptions} />
            ) : (
              <p className="text-sm text-muted">Waiting for live events.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <h3 className="text-base sm:text-lg font-semibold">Events in the last 7 days</h3>
          <span className="text-xs text-muted shrink-0">{allDisasters.length} current</span>
        </div>
        <div className="h-52 sm:h-80">
          <Bar data={liveCharts.dailyChart} options={chartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="bg-surface border border-border p-4 sm:p-6 hidden sm:block">
          <h3 className="text-lg font-semibold mb-4">Disaster type mix</h3>
          <div className="h-64">
            {liveCharts.typeChart.labels.length ? (
              <Doughnut data={liveCharts.typeChart} options={pieOptions} />
            ) : (
              <p className="text-sm text-muted">Waiting for live events.</p>
            )}
          </div>
        </div>
        <div className="bg-surface border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold">Live activity</h3>
            <span className="text-xs text-primary shrink-0">USGS + NASA</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentEvents.length ? (
              recentEvents.map((event) => (
                <div key={event.id} className="border border-border p-3">
                  <p className="text-sm font-medium text-foreground">{event.title || event.name}</p>
                  <p className="text-xs text-muted mt-1">
                    {event.disasterType} {event.location ? `in ${event.location}` : ""} {formatTimeAgo(event.startDate)}
                    {event.source ? ` · ${event.source}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No live events loaded yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
