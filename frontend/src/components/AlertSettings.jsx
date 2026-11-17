import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { useConnectivity } from "../context/ConnectivityContext";

const AlertSettings = () => {
  const { lowData, setLowData, canInstall, promptInstall, online, queueCount } = useConnectivity();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [sirenBusy, setSirenBusy] = useState(false);
  const [code, setCode] = useState("");
  const [otpNotice, setOtpNotice] = useState(null);
  const [proximity, setProximity] = useState({
    proximity_alerts_opt_in: false,
    has_location: false,
    updated_at: null,
  });
  const [form, setForm] = useState({
    email_alerts: true,
    whatsapp_alerts: false,
    radius_km: 100,
    min_magnitude: 4.5,
    latitude: "",
    longitude: "",
    phone: "",
    phone_verified: false,
  });

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      client.run("get", endpoints.alertPreferences, {}, true, false, false, false),
      client.run("get", endpoints.championsLocationPing, {}, true, false, false, false),
    ])
      .then(([prefRes, pingRes]) => {
        if (!active) return;
        if (prefRes.status === "fulfilled" && prefRes.value) {
          const data = prefRes.value;
          setForm({
            email_alerts: Boolean(data.email_alerts),
            whatsapp_alerts: Boolean(data.whatsapp_alerts),
            radius_km: data.radius_km || 100,
            min_magnitude: data.min_magnitude || 4.5,
            latitude: data.latitude ?? "",
            longitude: data.longitude ?? "",
            phone: data.phone || "",
            phone_verified: Boolean(data.phone_verified),
          });
        } else {
          toast.error("Could not load alert settings.");
        }
        if (pingRes.status === "fulfilled" && pingRes.value) {
          setProximity({
            proximity_alerts_opt_in: Boolean(pingRes.value.proximity_alerts_opt_in),
            has_location: Boolean(pingRes.value.has_location),
            updated_at: pingRes.value.updated_at || null,
          });
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("latitude", Number(pos.coords.latitude.toFixed(6)));
        update("longitude", Number(pos.coords.longitude.toFixed(6)));
        toast.success("Location captured for nearby alerts.");
      },
      () => toast.error("Could not read your location.")
    );
  };

  const postLocationPing = (coords, optIn) =>
    client.run(
      "post",
      endpoints.championsLocationPing,
      {
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy_m: coords?.accuracy,
        proximity_alerts_opt_in: optIn,
      },
      true,
      false,
      false,
      false
    );

  const enableNearbySirens = async () => {
    if (!navigator.geolocation) {
      toast.error("Location is required for nearby Champion sirens.");
      return;
    }
    setSirenBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await postLocationPing(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
            true
          );
          setProximity({
            proximity_alerts_opt_in: Boolean(data?.proximity_alerts_opt_in),
            has_location: true,
            updated_at: data?.updated_at || null,
          });
          toast.success("Opted in — Champions can warn your phone when you are near a hazard.");
        } catch {
          toast.error("Could not enable nearby sirens.");
        } finally {
          setSirenBusy(false);
        }
      },
      () => {
        setSirenBusy(false);
        toast.error("Allow location access to opt in to nearby sirens.");
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  const disableNearbySirens = async () => {
    setSirenBusy(true);
    try {
      const data = await postLocationPing(null, false);
      setProximity({
        proximity_alerts_opt_in: Boolean(data?.proximity_alerts_opt_in),
        has_location: Boolean(data?.has_location),
        updated_at: data?.updated_at || null,
      });
      toast.success("Nearby Champion sirens turned off.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not update nearby sirens.");
    } finally {
      setSirenBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        email_alerts: form.email_alerts,
        whatsapp_alerts: form.whatsapp_alerts,
        radius_km: Number(form.radius_km) || 100,
        min_magnitude: Number(form.min_magnitude) || 4.5,
        phone: form.phone,
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      };
      const data = await client.run(
        "put",
        endpoints.alertPreferences,
        payload,
        true,
        false,
        false,
        false
      );
      setForm((prev) => ({
        ...prev,
        ...data,
        latitude: data?.latitude ?? prev.latitude,
        longitude: data?.longitude ?? prev.longitude,
      }));
      toast.success("Alert settings saved.");
    } catch (error) {
      toast.error("Could not save alert settings.");
    } finally {
      setSaving(false);
    }
  };

  const requestCode = async () => {
    setOtpBusy(true);
    setOtpNotice(null);
    try {
      const data = await client.run(
        "post",
        endpoints.alertPhoneRequest,
        { phone: form.phone },
        true,
        false,
        false,
        false
      );
      const via = Array.isArray(data?.sent_via) ? data.sent_via : [];
      const to = data?.sent_to ? `+${data.sent_to}` : form.phone;
      if (via.includes("whatsapp")) {
        const msg =
          data?.message ||
          `Code sent to ${to} on WhatsApp (FlowOps Africa).`;
        setOtpNotice({ tone: "ok", text: msg });
        toast.success(msg);
      } else if (via.includes("email")) {
        const msg =
          data?.message ||
          "WhatsApp could not deliver the code. Check your account email (and spam) for the 6-digit code, then enter it here.";
        setOtpNotice({ tone: "warn", text: msg });
        toast.warn(msg);
      } else {
        const msg = data?.message || "Verification code sent.";
        setOtpNotice({ tone: "ok", text: msg });
        toast.success(msg);
      }
    } catch (error) {
      setOtpNotice({
        tone: "warn",
        text: "Could not send verification code. Try again shortly.",
      });
      toast.error("Could not send verification code.");
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmCode = async () => {
    setOtpBusy(true);
    try {
      await client.run(
        "post",
        endpoints.alertPhoneConfirm,
        { code },
        true,
        false,
        false,
        false
      );
      setForm((prev) => ({ ...prev, phone_verified: true }));
      setOtpNotice(null);
      toast.success("Phone verified for WhatsApp alerts.");
    } catch (error) {
      toast.error("Invalid or expired code.");
    } finally {
      setOtpBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted">Loading alert settings…</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Disaster alert settings</h1>
        <p className="mt-2 text-sm text-muted">
          Climate Wavers sends source-tagged operational alerts from USGS, NASA, and community
          reports. This is not a government emergency warning system.
        </p>
        <div className="mt-4 border border-border bg-surface p-4">
          <p className="text-sm font-medium text-foreground">Response organization?</p>
          <p className="mt-1 text-sm text-muted">
            Apply for RapidBrief to receive AI disaster dispatches for your agency or NGO.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/responders/apply"
              className="inline-flex min-h-10 items-center px-4 bg-primary text-primary-foreground text-sm font-medium"
            >
              Apply as Responder
            </Link>
            <Link
              to="/app/responder"
              className="inline-flex min-h-10 items-center px-4 border border-border bg-background text-sm font-medium"
            >
              Open Responder Desk
            </Link>
          </div>
        </div>
      </header>

      <div className="border border-border bg-surface p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Use Climate Wavers without data</p>
          <p className="mt-1 text-sm text-muted">
            Install the app, keep low data mode on, and open it once while online. After that,
            cached alerts stay available offline. Disaster reports queue on your phone and sync
            when signal returns.
          </p>
          <p className="mt-2 text-xs text-muted">
            Status: {online ? "Online" : "Offline"}
            {queueCount > 0 ? ` · ${queueCount} report${queueCount === 1 ? "" : "s"} queued` : ""}
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={lowData}
            onChange={(e) => setLowData(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">Low data mode</span>
            <span className="block text-muted">
              Hides heavy images and skips live vision uploads so the app stays usable on weak
              connections.
            </span>
          </span>
        </label>
        {canInstall ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await promptInstall();
              toast[ok ? "success" : "info"](
                ok ? "App installed — open it from your home screen offline." : "Install dismissed."
              );
            }}
            className="inline-flex min-h-10 items-center px-4 bg-primary text-primary-foreground text-sm font-medium"
          >
            Install for offline access
          </button>
        ) : (
          <p className="text-xs text-muted">
            On phone: browser menu → Add to Home Screen. Open Climate Wavers once online so the
            offline shell can cache.
          </p>
        )}
      </div>

      <form onSubmit={save} className="space-y-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.email_alerts}
            onChange={(e) => update("email_alerts", e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">Email alerts</span>
            <span className="block text-muted">Send disaster notices to your account email.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.whatsapp_alerts}
            onChange={(e) => update("whatsapp_alerts", e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium text-foreground">WhatsApp alerts (Meta)</span>
            <span className="block text-muted">
              Requires a verified phone and approved Meta message templates.
            </span>
          </span>
        </label>

        <div className="border border-border bg-surface p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Nearby Champion sirens</p>
            <p className="mt-1 text-sm text-muted">
              Opt in so Community Champions can send a geofenced phone siren when you are
              near a verified hazard. Uses recent device location — not SMS-first.
            </p>
          </div>
          <p className="text-xs text-muted">
            Status:{" "}
            {proximity.proximity_alerts_opt_in
              ? "Opted in"
              : proximity.has_location
                ? "Location saved · sirens off"
                : "Not opted in"}
            {proximity.updated_at
              ? ` · last update ${new Date(proximity.updated_at).toLocaleString()}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {proximity.proximity_alerts_opt_in ? (
              <button
                type="button"
                disabled={sirenBusy}
                onClick={disableNearbySirens}
                className="h-10 px-4 border border-border text-sm disabled:opacity-50"
              >
                {sirenBusy ? "Updating…" : "Turn off nearby sirens"}
              </button>
            ) : (
              <button
                type="button"
                disabled={sirenBusy}
                onClick={enableNearbySirens}
                className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {sirenBusy ? "Enabling…" : "Opt in with my location"}
              </button>
            )}
            {proximity.proximity_alerts_opt_in ? (
              <button
                type="button"
                disabled={sirenBusy}
                onClick={enableNearbySirens}
                className="h-10 px-4 border border-border text-sm disabled:opacity-50"
              >
                Refresh location
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="radius">
            Alert radius (km)
          </label>
          <input
            id="radius"
            type="number"
            min={10}
            max={500}
            value={form.radius_km}
            onChange={(e) => update("radius_km", e.target.value)}
            className="w-full h-11 px-3 border border-border bg-surface"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="mag">
            Minimum earthquake magnitude
          </label>
          <input
            id="mag"
            type="number"
            step="0.1"
            min={2}
            max={9}
            value={form.min_magnitude}
            onChange={(e) => update("min_magnitude", e.target.value)}
            className="w-full h-11 px-3 border border-border bg-surface"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lat">
              Latitude
            </label>
            <input
              id="lat"
              value={form.latitude}
              onChange={(e) => update("latitude", e.target.value)}
              className="w-full h-11 px-3 border border-border bg-surface"
              placeholder="-1.286389"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lng">
              Longitude
            </label>
            <input
              id="lng"
              value={form.longitude}
              onChange={(e) => update("longitude", e.target.value)}
              className="w-full h-11 px-3 border border-border bg-surface"
              placeholder="36.817223"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="text-sm text-primary hover:text-primary-dark"
        >
          Use my current location
        </button>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="phone">
            WhatsApp phone (E.164)
          </label>
          <input
            id="phone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="w-full h-11 px-3 border border-border bg-surface"
            placeholder="+2547…"
          />
          <p className="mt-1 text-xs text-muted">
            {form.phone_verified
              ? "Phone verified."
              : "Phone not verified yet. Codes arrive on this number from FlowOps Africa WhatsApp (Meta), not to the business number."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={otpBusy || !form.phone}
            onClick={requestCode}
            className="h-10 px-4 border border-border text-sm disabled:opacity-50"
          >
            {otpBusy ? "Sending…" : "Send code"}
          </button>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-10 w-28 px-3 border border-border bg-surface text-center tracking-widest"
            placeholder="000000"
            inputMode="numeric"
          />
          <button
            type="button"
            disabled={otpBusy || code.length !== 6}
            onClick={confirmCode}
            className="h-10 px-4 border border-border text-sm disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
        {otpNotice ? (
          <p
            role="status"
            className={
              otpNotice.tone === "warn"
                ? "text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2"
                : "text-sm text-muted"
            }
          >
            {otpNotice.text}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="h-11 px-5 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save alert settings"}
        </button>
      </form>
    </div>
  );
};

export default AlertSettings;
