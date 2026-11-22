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

const CITY_CENTERS = {
  Eldoret: [0.5143, 35.2698],
  Nairobi: [-1.2921, 36.8219],
  Mombasa: [-4.0435, 39.6682],
  Kisumu: [-0.0917, 34.768],
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function recyclerIcon(selected) {
  const color = selected ? "#0d9488" : "#0369a1";
  return L.divIcon({
    className: "plastic-recycler-marker",
    html: `<div style="
      width:26px;height:26px;border-radius:50%;
      background:${color};border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

function youIcon() {
  return L.divIcon({
    className: "plastic-you-marker",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:#f59e0b;border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/**
 * Map of recycler yards with GPS. Tap a pin to select / claim.
 */
export default function PlasticRecyclerNearbyMap({
  recyclers = [],
  selectedId = "",
  onSelect,
  myLat = null,
  myLng = null,
  city = "Eldoret",
  heightClass = "h-64 sm:h-80",
  emptyHint = "No yards with GPS yet nearby.",
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const points = useMemo(
    () =>
      (Array.isArray(recyclers) ? recyclers : [])
        .map((r) => {
          const lat = Number(r.latitude);
          const lng = Number(r.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng, data: r };
        })
        .filter(Boolean),
    [recyclers]
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const fallback = CITY_CENTERS[city] || CITY_CENTERS.Eldoret;
    const map = L.map(mapRef.current, {
      center: fallback,
      zoom: 12,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    const refresh = () => map.invalidateSize();
    setTimeout(refresh, 80);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      map.remove();
      mapInstanceRef.current = null;
      layerRef.current = null;
    };
  }, [city]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = [];
    for (const pt of points) {
      const selected = String(selectedId) === String(pt.data.id);
      const marker = L.marker([pt.lat, pt.lng], {
        icon: recyclerIcon(selected),
      });
      const phone = escapeHtml(pt.data.contact_phone || "");
      const name = escapeHtml(pt.data.name || "Yard");
      const cityLabel = escapeHtml(pt.data.city || "");
      marker.bindPopup(
        `<div style="min-width:140px">
          <strong>${name}</strong><br/>
          <span style="font-size:12px;color:#64748b">${cityLabel}${
            phone ? ` · ${phone}` : ""
          }</span><br/>
          <button type="button" data-select-recycler="${escapeHtml(
            pt.data.id
          )}" style="margin-top:6px;padding:4px 8px;background:#0d9488;color:#fff;border:0;cursor:pointer;font-size:12px">
            Select this yard
          </button>
        </div>`
      );
      marker.on("click", () => {
        onSelectRef.current?.(pt.data);
      });
      marker.on("popupopen", (e) => {
        const btn = e.popup
          ?.getElement()
          ?.querySelector("[data-select-recycler]");
        if (btn) {
          btn.onclick = (ev) => {
            ev.preventDefault();
            onSelectRef.current?.(pt.data);
          };
        }
      });
      marker.addTo(layer);
      bounds.push([pt.lat, pt.lng]);
    }

    // Number(null) === 0 — treat missing GPS as absent, not Null Island (ocean).
    const myLatN =
      myLat === null || myLat === undefined || myLat === ""
        ? NaN
        : Number(myLat);
    const myLngN =
      myLng === null || myLng === undefined || myLng === ""
        ? NaN
        : Number(myLng);
    if (Number.isFinite(myLatN) && Number.isFinite(myLngN)) {
      L.marker([myLatN, myLngN], { icon: youIcon() })
        .bindPopup("You (captured GPS)")
        .addTo(layer);
      bounds.push([myLatN, myLngN]);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    } else {
      const fallback = CITY_CENTERS[city] || CITY_CENTERS.Eldoret;
      map.setView(fallback, 12);
    }
    setTimeout(() => map.invalidateSize(), 60);
  }, [points, selectedId, myLat, myLng, city]);

  return (
    <div className="space-y-2">
      <div
        ref={mapRef}
        className={`w-full ${heightClass} border border-border z-0 rounded-none`}
      />
      {!points.length ? (
        <p className="text-xs text-muted">{emptyHint}</p>
      ) : (
        <p className="text-xs text-muted">
          {points.length} yard{points.length === 1 ? "" : "s"} with GPS · tap a pin to
          select
          {myLat !== null &&
          myLat !== undefined &&
          myLat !== "" &&
          Number.isFinite(Number(myLat))
            ? " · amber = you"
            : ""}
        </p>
      )}
    </div>
  );
}
