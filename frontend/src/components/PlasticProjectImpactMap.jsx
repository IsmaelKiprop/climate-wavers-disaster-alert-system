import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function statusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const HOTSPOT_COLORS = {
  open: "#ca8a04",
  claimed: "#0369a1",
  cleared: "#0d9488",
};

function hotspotIcon(status, drainRelated) {
  const color = HOTSPOT_COLORS[status] || "#64748b";
  const ring = drainRelated ? "#dc2626" : "#ffffff";
  return L.divIcon({
    className: "plastic-project-hotspot-marker",
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${color};border:3px solid ${ring};
      box-shadow:0 2px 8px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function recoveryIcon(confirmed) {
  const color = confirmed ? "#0d9488" : "#64748b";
  return L.divIcon({
    className: "plastic-project-recovery-marker",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

/**
 * Live map of cleanup hotspots + bag recovery points for a Plastic Pulse project.
 */
export default function PlasticProjectImpactMap({
  project,
  heightClass = "h-[22rem] sm:h-[28rem]",
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);

  const points = useMemo(() => {
    const hotspots = Array.isArray(project?.hotspots) ? project.hotspots : [];
    const recoveries = Array.isArray(project?.recent_recoveries)
      ? project.recent_recoveries
      : [];

    const hotspotPts = hotspots
      .map((h) => {
        const lat = Number(h.latitude);
        const lng = Number(h.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { kind: "hotspot", lat, lng, data: h };
      })
      .filter(Boolean);

    const recoveryPts = recoveries
      .map((r) => {
        const lat = Number(r.latitude);
        const lng = Number(r.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { kind: "recovery", lat, lng, data: r };
      })
      .filter(Boolean);

    return { hotspotPts, recoveryPts };
  }, [project?.hotspots, project?.recent_recoveries]);

  const hasMap = points.hotspotPts.length > 0 || points.recoveryPts.length > 0;

  useEffect(() => {
    if (!hasMap || !mapRef.current) return undefined;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);
      mapInstanceRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const layer = layerRef.current;
    layer.clearLayers();

    const bounds = [];

    points.hotspotPts.forEach(({ lat, lng, data: h }) => {
      const title = escapeHtml(h.title || h.location_label || `Hotspot #${h.id}`);
      const status = escapeHtml(statusLabel(h.status));
      const severity = escapeHtml(statusLabel(h.severity));
      const drain = h.drain_related
        ? '<p style="margin:4px 0 0;color:#b91c1c;font-size:12px;">Drain / flood corridor</p>'
        : "";
      const marker = L.marker([lat, lng], {
        icon: hotspotIcon(h.status, h.drain_related),
      }).bindPopup(
        `<div style="min-width:160px;font-family:system-ui,sans-serif">
          <strong style="font-size:13px">${title}</strong>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b">${status} · ${severity}</p>
          ${drain}
        </div>`
      );
      marker.addTo(layer);
      bounds.push([lat, lng]);

      // Soft radius around CBO pin — same ~250m claim zone story
      if (h.status !== "cleared") {
        L.circle([lat, lng], {
          radius: 250,
          color: HOTSPOT_COLORS[h.status] || "#64748b",
          weight: 1,
          fillColor: HOTSPOT_COLORS[h.status] || "#64748b",
          fillOpacity: 0.08,
          opacity: 0.45,
        }).addTo(layer);
      }
    });

    points.recoveryPts.forEach(({ lat, lng, data: r }) => {
      const confirmed = r.status === "intake_confirmed" || r.status === "cbo_verified";
      const bag = escapeHtml(r.bag_id || "Bag");
      const kg = escapeHtml(r.kg_verified ?? r.kg_claimed ?? "—");
      const st = escapeHtml(statusLabel(r.status));
      const polymer = escapeHtml(r.polymer_type || "");
      const marker = L.marker([lat, lng], {
        icon: recoveryIcon(confirmed),
      }).bindPopup(
        `<div style="min-width:140px;font-family:system-ui,sans-serif">
          <strong style="font-size:13px">${bag}</strong>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b">${kg} kg · ${polymer}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#64748b">${st}</p>
        </div>`
      );
      marker.addTo(layer);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
    }

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [hasMap, points]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  if (!hasMap) {
    return (
      <div className="border border-border bg-surface p-5 space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Cleanup map</h2>
        <p className="text-sm text-muted leading-relaxed">
          Hotspot pins and bag GPS will appear here as the CBO maps sites and collectors
          log recoveries in the field.
        </p>
      </div>
    );
  }

  const openCount = points.hotspotPts.filter((p) => p.data.status === "open").length;
  const clearedCount = points.hotspotPts.filter((p) => p.data.status === "cleared").length;
  const drainCount = points.hotspotPts.filter((p) => p.data.drain_related).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Where cleanup happens</p>
          <h2 className="text-lg font-semibold text-foreground">Cleanup map</h2>
          <p className="text-sm text-muted mt-0.5 max-w-xl">
            Live pins from CBO hotspot GPS and collector bag locations — the same
            coordinates used for claim PIN + proximity checks on the ground.
          </p>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] text-muted">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-600" aria-hidden />
            Open {openCount}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-700" aria-hidden />
            Claimed
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600" aria-hidden />
            Cleared {clearedCount}
          </li>
          {drainCount > 0 ? (
            <li className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-teal-600 ring-2 ring-red-600"
                aria-hidden
              />
              Drain / flood {drainCount}
            </li>
          ) : null}
        </ul>
      </div>

      <div
        className={`relative border border-border overflow-hidden bg-background ${heightClass}`}
      >
        <div ref={mapRef} className="absolute inset-0 z-0" />
      </div>
    </section>
  );
}
