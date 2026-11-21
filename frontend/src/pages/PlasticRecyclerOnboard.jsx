import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import PlasticRecyclerNearbyMap from "../components/PlasticRecyclerNearbyMap";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { apiUrl } from "../config/env";
import { RECYCLER_MATERIALS } from "../utils/plasticPolymers";

const CITIES = ["Eldoret", "Nairobi", "Mombasa", "Kisumu"];

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function api(path, { method = "GET", body } = {}) {
  const token = getAuthToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

const PlasticRecyclerOnboard = () => {
  const navigate = useNavigate();
  const token = getAuthToken();
  const [directory, setDirectory] = useState([]);
  const [city, setCity] = useState("Eldoret");
  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [form, setForm] = useState({
    name: "",
    city: "Eldoret",
    contact_phone: "",
    contact_email: "",
    address: "",
    website: "",
    application_message: "",
    accepts_small_lots: true,
    directory_recycler_id: "",
    materials_accepted: [...RECYCLER_MATERIALS],
    latitude: "",
    longitude: "",
  });

  const load = useCallback(async () => {
    const q = new URLSearchParams({ city });
    const dir = await fetch(
      apiUrl(`${endpoints.plasticRecyclerDirectory}?${q}`),
      { headers: { Accept: "application/json" } }
    ).then((r) => r.json());
    setDirectory(Array.isArray(dir?.recyclers) ? dir.recyclers : []);
    if (token) {
      try {
        setMe(await api(endpoints.plasticRecyclerMe));
      } catch {
        setMe(null);
      }
    }
  }, [city, token]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const mapRecyclers = useMemo(() => {
    const withGps = directory.filter(
      (r) =>
        Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
    );
    const myLat = Number(form.latitude);
    const myLng = Number(form.longitude);
    if (!Number.isFinite(myLat) || !Number.isFinite(myLng)) return withGps;
    return [...withGps].sort(
      (a, b) =>
        haversineKm(myLat, myLng, a.latitude, a.longitude) -
        haversineKm(myLat, myLng, b.latitude, b.longitude)
    );
  }, [directory, form.latitude, form.longitude]);

  const claim = (r) => {
    setForm((p) => ({
      ...p,
      directory_recycler_id: String(r.id),
      name: r.name || p.name,
      city: r.city || p.city,
      contact_phone: r.contact_phone || p.contact_phone,
      contact_email: r.contact_email || p.contact_email,
      address: r.address || p.address,
      website: r.website || p.website,
      materials_accepted: r.materials_accepted?.length
        ? r.materials_accepted
        : p.materials_accepted,
      accepts_small_lots: r.accepts_small_lots !== false,
      // Always force a fresh device capture at the yard — do not trust listed coords.
      latitude: "",
      longitude: "",
    }));
    toast.info(`Claiming ${r.name} — capture GPS at the yard to continue`);
  };

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available on this device");
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        toast.success("Yard GPS captured");
        setCapturingGps(false);
      },
      () => {
        toast.error("Could not get GPS — allow location and try again at the yard");
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!token) {
      toast.error("Sign in first to apply as a recycler");
      navigate("/login");
      return;
    }
    if (!form.latitude || !form.longitude) {
      toast.error("Capture yard GPS before submitting");
      return;
    }
    setSaving(true);
    try {
      const result = await api(endpoints.plasticRecyclerApply, {
        method: "POST",
        body: {
          ...form,
          directory_recycler_id: form.directory_recycler_id || undefined,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        },
      });
      toast.success(result.next || "Application submitted");
      setMe(await api(endpoints.plasticRecyclerMe));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const partner = me?.partners?.[0];
  const status = partner?.onboarding_status;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">Plastic Pulse</p>
          <h1 className="text-3xl font-semibold">Recycler onboarding</h1>
          <p className="text-sm text-muted">
            Join Climate Wavers marketplace: buy lots from CBOs, pay the platform, we pay
            collectors. After approval you get bag scan + marketplace desk.
          </p>
        </div>

        {status === "applied" ? (
          <div className="border border-border p-4 text-sm">
            Application for <strong>{partner.name}</strong> is pending Climate Wavers
            superadmin approval.
          </div>
        ) : null}
        {status === "approved" ? (
          <div className="border border-border p-4 text-sm space-y-2">
            <p>
              <strong>{partner.name}</strong> is approved.
            </p>
            <Link
              to="/plastic/desk"
              className="inline-flex h-9 px-3 bg-primary text-white text-sm items-center"
            >
              Open recycler desk
            </Link>
          </div>
        ) : null}

        {!token ? (
          <p className="text-sm text-muted">
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>{" "}
            (or create an account) before applying.
          </p>
        ) : null}

        <div className="space-y-3 border border-border p-4">
          <div className="space-y-1">
            <h2 className="font-medium">Yards near you</h2>
            <p className="text-xs text-muted">
              See recyclers already listed around you on the map. Tap a pin (or row) to
              claim that yard, then capture GPS at the site to confirm you are there.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCity(c);
                  setForm((p) => ({ ...p, city: c }));
                }}
                className={`h-8 px-3 text-xs border ${
                  city === c
                    ? "border-primary text-primary"
                    : "border-border text-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <PlasticRecyclerNearbyMap
            recyclers={mapRecyclers}
            selectedId={form.directory_recycler_id}
            onSelect={claim}
            myLat={form.latitude || null}
            myLng={form.longitude || null}
            city={city}
            emptyHint={`No ${city} yards with GPS yet — fill a new application below, or capture GPS so your pin appears for the next applicant.`}
          />
          <div className="space-y-2 max-h-48 overflow-auto">
            {mapRecyclers.map((r) => {
              const myLat = Number(form.latitude);
              const myLng = Number(form.longitude);
              const km =
                Number.isFinite(myLat) && Number.isFinite(myLng)
                  ? haversineKm(myLat, myLng, r.latitude, r.longitude)
                  : null;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => claim(r)}
                  className={`w-full text-left border p-3 text-sm ${
                    String(form.directory_recycler_id) === String(r.id)
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted">
                    {r.contact_phone || "No phone"}
                    {km != null ? ` · ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away` : ""}
                  </div>
                </button>
              );
            })}
            {!mapRecyclers.length && directory.length ? (
              <p className="text-xs text-muted">
                {directory.length} listed without GPS — they cannot appear on the map yet.
              </p>
            ) : null}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 border border-border p-4">
          <h2 className="font-medium">Application</h2>
          <input
            className="w-full h-10 px-3 border border-border bg-background"
            placeholder="Company / yard name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <select
            className="w-full h-10 px-3 border border-border bg-background"
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="w-full h-10 px-3 border border-border bg-background"
            placeholder="WhatsApp / phone"
            value={form.contact_phone}
            onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
          />
          <input
            className="w-full h-10 px-3 border border-border bg-background"
            placeholder="Email"
            type="email"
            value={form.contact_email}
            onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
          />
          <input
            className="w-full h-10 px-3 border border-border bg-background"
            placeholder="Yard address"
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          />
          <div className="space-y-2 border border-border p-3">
            <p className="text-sm font-medium">Yard location (required)</p>
            <p className="text-xs text-muted">
              You must capture GPS on this device while at the recycling yard. Manual
              coordinates are not allowed. Climate Wavers reviews this pin before approval.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={captureGps}
                disabled={capturingGps}
                className={`h-10 px-3 text-sm disabled:opacity-60 ${
                  form.latitude && form.longitude
                    ? "border border-border"
                    : "bg-primary text-white"
                }`}
              >
                {capturingGps
                  ? "Capturing…"
                  : form.latitude && form.longitude
                    ? "Recapture GPS"
                    : "Capture GPS to continue"}
              </button>
              {form.latitude && form.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3 border border-border text-sm inline-flex items-center text-primary"
                >
                  Preview on map
                </a>
              ) : null}
            </div>
            {form.latitude && form.longitude ? (
              <p className="text-xs text-muted">
                GPS captured: {form.latitude}, {form.longitude}
              </p>
            ) : (
              <p className="text-xs text-red-500">
                Capture GPS at the yard — submit stays locked until then.
              </p>
            )}
          </div>
          <div className="space-y-2 border border-border p-3">
            <p className="text-sm font-medium">Polymers you buy</p>
            <p className="text-xs text-muted">
              Select resin types your yard accepts (SPI codes 1–7).
            </p>
            <div className="flex flex-wrap gap-2">
              {RECYCLER_MATERIALS.map((m) => {
                const checked = form.materials_accepted.includes(m);
                return (
                  <label
                    key={m}
                    className={`inline-flex items-center gap-1.5 h-9 px-2.5 border text-sm cursor-pointer ${
                      checked
                        ? "border-primary text-primary"
                        : "border-border text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          materials_accepted: checked
                            ? p.materials_accepted.filter((x) => x !== m)
                            : [...p.materials_accepted, m],
                        }))
                      }
                    />
                    {m}
                  </label>
                );
              })}
            </div>
          </div>
          <textarea
            className="w-full min-h-20 px-3 py-2 border border-border bg-background text-sm"
            placeholder="Typical lot size, pricing notes, anything else"
            value={form.application_message}
            onChange={(e) =>
              setForm((p) => ({ ...p, application_message: e.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.accepts_small_lots}
              onChange={(e) =>
                setForm((p) => ({ ...p, accepts_small_lots: e.target.checked }))
              }
            />
            We can buy small CBO lots (~40–120 kg/week)
          </label>
          <button
            type="submit"
            disabled={saving || !token || !form.latitude || !form.longitude}
            className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
          >
            {saving
              ? "Submitting…"
              : !form.latitude || !form.longitude
                ? "Capture GPS first"
                : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlasticRecyclerOnboard;
