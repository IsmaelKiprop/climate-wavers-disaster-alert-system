import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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

const createDisasterIcon = (severity) => {
  const colors = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#d97706",
    LOW: "#16a34a",
  };

  return L.divIcon({
    className: "custom-disaster-marker",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        background: ${colors[severity] || colors.LOW};
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        cursor: pointer;
      ">
        ${
          severity === "CRITICAL"
            ? "!"
            : severity === "HIGH"
              ? "!"
              : severity === "MEDIUM"
                ? "•"
                : "+"
        }
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function disasterDetailPath(disasterId) {
  return `/disasters/${encodeURIComponent(String(disasterId || ""))}`;
}

const LeafletMap = ({ disasters, onDisasterClick }) => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [0, 20],
      zoom: 2,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Free OSM tiles (no API key). Avoid Carto CDN — it now requires a key.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    const refreshSize = () => {
      map.invalidateSize(true);
    };

    const frame = window.requestAnimationFrame(refreshSize);
    const t1 = window.setTimeout(refreshSize, 100);
    const t2 = window.setTimeout(refreshSize, 400);

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(refreshSize);
      observer.observe(mapRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      observer?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current = [];

    (disasters || [])
      .filter(
        (disaster) =>
          disaster?.coordinates?.lat != null && disaster?.coordinates?.lng != null
      )
      .forEach((disaster) => {
        const marker = L.marker(
          [disaster.coordinates.lat, disaster.coordinates.lng],
          { icon: createDisasterIcon(disaster.severity) }
        );

        const detailPath = disasterDetailPath(disaster.id);
        const updatedAt = disaster.lastUpdated
          ? new Date(disaster.lastUpdated).toLocaleString()
          : "Unknown";
        const popupContent = `
        <div style="padding: 8px; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${
              disaster.severity === "CRITICAL"
                ? "#dc2626"
                : disaster.severity === "HIGH"
                  ? "#ea580c"
                  : disaster.severity === "MEDIUM"
                    ? "#d97706"
                    : "#16a34a"
            }"></div>
            <span style="font-weight: bold; font-size: 14px;">${escapeHtml(disaster.severity)}</span>
          </div>
          <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${escapeHtml(disaster.name)}</h3>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">${escapeHtml(disaster.type)}</p>
          <p style="font-size: 13px; color: #374151; margin-bottom: 8px;">${escapeHtml(disaster.description)}</p>
          <div style="font-size: 12px; color: #6b7280;">
            <p><strong>Location:</strong> ${escapeHtml(disaster.location)}</p>
            <p><strong>Coordinates:</strong> ${disaster.coordinates.lat.toFixed(4)}, ${disaster.coordinates.lng.toFixed(4)}</p>
            <p><strong>Last Updated:</strong> ${escapeHtml(updatedAt)}</p>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <a href="${detailPath}"
               data-disaster-link="true"
               style="display:block;width:100%;box-sizing:border-box;text-align:center;background:#067d83;color:white;padding:8px 12px;border:0;font-size:13px;font-weight:600;text-decoration:none;">
              View details
            </a>
          </div>
        </div>
      `;

        marker.bindPopup(popupContent);
        marker.addTo(map);
        markersRef.current.push(marker);

        marker.on("click", () => {
          onDisasterClick?.(disaster);
        });

        marker.on("popupopen", () => {
          const popupEl = marker.getPopup()?.getElement();
          const link = popupEl?.querySelector("[data-disaster-link]");
          if (!link || link.dataset.bound === "true") return;
          link.dataset.bound = "true";
          link.addEventListener("click", (event) => {
            event.preventDefault();
            navigateRef.current(detailPath, { state: { disaster } });
          });
        });
      });

    map.invalidateSize(true);
    if (markersRef.current.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [disasters, onDisasterClick]);

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden bg-[#e8eef0]">
      <div ref={mapRef} className="absolute inset-0 z-0" style={{ width: "100%", height: "100%" }} />

      <div className="hidden sm:block absolute top-3 right-3 bg-surface border border-border p-3 z-[1000] max-w-[160px]">
        <p className="text-foreground text-xs font-semibold mb-2">Severity</p>
        <div className="text-xs text-muted space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500" />
            <span>Low</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 bg-surface border border-border p-3 z-[1000] max-w-[calc(100%-1.5rem)] sm:max-w-xs">
        <p className="text-foreground text-xs font-semibold mb-1">
          {(disasters || []).length} live events
        </p>
        <p className="text-xs text-muted">
          Critical {(disasters || []).filter((d) => d.severity === "CRITICAL").length} · High{" "}
          {(disasters || []).filter((d) => d.severity === "HIGH").length}
        </p>
      </div>
    </div>
  );
};

export default LeafletMap;
