import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import PublicPage from "../components/PublicPage";
import { apiUrl } from "../config/env";
import { endpoints } from "../utils/endpoints";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LAYERS = [
  { id: "all", label: "All" },
  { id: "trees", label: "Trees" },
  { id: "plastic", label: "Plastic" },
  { id: "hazards", label: "Hazards" },
  { id: "eco", label: "Eco Pulse" },
];

const LAYER_COLORS = {
  trees: "#0d9488",
  plastic: "#0369a1",
  hazards: "#b45309",
  eco: "#7c3aed",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layerIcon(layer) {
  const color = LAYER_COLORS[layer] || "#64748b";
  return L.divIcon({
    className: "community-impact-marker",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

const CommunityImpactMapPage = () => {
  const [layer, setLayer] = useState("all");
  const [county, setCounty] = useState("");
  const [data, setData] = useState({
    features: [],
    counties: [],
    count: 0,
    errors: [],
    skippedInaccurate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (layer && layer !== "all") params.set("layer", layer);
      if (county) params.set("county", county);
      const qs = params.toString();
      const url = apiUrl(`${endpoints.impactMap}${qs ? `?${qs}` : ""}`);
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.detail || "Could not load impact map");
      }
      setData({
        features: Array.isArray(json.features) ? json.features : [],
        counties: Array.isArray(json.counties) ? json.counties : [],
        count: Number(json.count || 0),
        errors: Array.isArray(json.errors) ? json.errors : [],
        skippedInaccurate: Number(json.skipped_inaccurate_gps || 0),
      });
    } catch (err) {
      setError(err?.message || "Could not load impact map");
      setData({
        features: [],
        counties: [],
        count: 0,
        errors: [],
        skippedInaccurate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [layer, county]);

  useEffect(() => {
    load();
  }, [load]);

  const points = useMemo(
    () =>
      (data.features || [])
        .map((f) => {
          const lat = Number(f.latitude);
          const lng = Number(f.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng, data: f };
        })
        .filter(Boolean),
    [data.features]
  );

  useEffect(() => {
    if (!mapRef.current) return undefined;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        attributionControl: true,
      }).setView([-1.286389, 36.817223], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);
      mapInstanceRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const group = layerRef.current;
    group.clearLayers();

    const bounds = [];
    points.forEach(({ lat, lng, data: f }) => {
      const title = escapeHtml(f.title || "Impact point");
      const subtitle = escapeHtml(f.subtitle || f.layer || "");
      const place = escapeHtml(
        [f.ward, f.county].filter(Boolean).join(" · ") || ""
      );
      const marker = L.marker([lat, lng], {
        icon: layerIcon(f.layer),
      }).bindPopup(
        `<div style="min-width:160px;font-family:system-ui,sans-serif">
          <strong style="font-size:13px">${title}</strong>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b">${subtitle}</p>
          ${place ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b">${place}</p>` : ""}
        </div>`
      );
      marker.addTo(group);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    } else {
      map.setView([-1.286389, 36.817223], 6);
    }

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [points]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  return (
    <PublicPage
      path="/impact-map"
      title="Community impact map"
      description="Trees, plastic cleanup sites, and nearby hazards mapped across counties."
      wide
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Live ground truth
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-foreground">
        Community impact map
      </h1>
      <p className="mt-3 text-muted max-w-3xl">
        Planted gifts, plastic hotspots, and active hazard reports in one place.
        Filter by layer or county to see what your community is verifying.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {LAYERS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLayer(opt.id)}
            className={`h-9 px-3 text-sm border ${
              layer === opt.id
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-surface text-foreground hover:border-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {county ? (
          <button
            type="button"
            onClick={() => setCounty("")}
            className="h-9 px-3 text-sm border border-border bg-background text-muted"
          >
            Clear county
          </button>
        ) : null}
      </div>

      {data.counties?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.counties.map((c) => {
            const name = c.county || "Unknown";
            const active = county === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setCounty(active ? "" : name)}
                className={`h-8 px-2.5 text-xs border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-surface text-foreground"
                }`}
              >
                {name}
                <span className="ml-1.5 text-[10px] opacity-80">
                  T{c.trees || 0} · P{c.plastic_points || 0} · H{c.hazards || 0} · E{c.eco_kits || 0}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {loading
            ? "Loading map…"
            : error
              ? error
              : `${data.count || points.length} point${
                  (data.count || points.length) === 1 ? "" : "s"
                }`}
          {!loading && !error && !(data.count || points.length) ? (
            <span className="block mt-1 text-xs">
              Only accurate on-site GPS pins are shown. Capture planting proof, plastic
              hotspot/bag proof, or a hazard report on a phone at the real location (±100
              m) — desktop IP cities are rejected.
            </span>
          ) : null}
          {!loading && data.skippedInaccurate > 0 ? (
            <span className="block mt-1 text-xs text-amber-700">
              {data.skippedInaccurate} saved GPS pin
              {data.skippedInaccurate === 1 ? "" : "s"} omitted because the coordinates
              are outside the supported East Africa area. If this is planting proof,
              re-publish it with the correct decimal latitude and longitude to show the tree.
            </span>
          ) : null}
          {!loading && data.errors?.length ? (
            <span className="block mt-1 text-xs text-amber-700">
              Some layers failed to load. Refresh or try again shortly.
            </span>
          ) : null}
        </p>
        <ul className="flex flex-wrap gap-3 text-[11px] text-muted">
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600" aria-hidden />
            Trees
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-700" aria-hidden />
            Plastic
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700" aria-hidden />
            Hazards
          </li>
        </ul>
      </div>

      <div className="relative mt-3 border border-border overflow-hidden bg-background h-[22rem] sm:h-[32rem]">
        <div ref={mapRef} className="absolute inset-0 z-0" />
      </div>

      <p className="mt-4 text-sm text-muted">
        Looking for totals and narrative?{" "}
        <Link to="/impact" className="text-primary">
          Open the Impact page
        </Link>
        .
      </p>
    </PublicPage>
  );
};

export default CommunityImpactMapPage;
