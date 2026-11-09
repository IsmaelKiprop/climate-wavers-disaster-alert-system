import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";

const AlertSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [code, setCode] = useState("");
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
    client
      .run("get", endpoints.alertPreferences, {}, true, false, false, false)
      .then((data) => {
        if (!active || !data) return;
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
      })
      .catch(() => toast.error("Could not load alert settings."))
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
    try {
      await client.run(
        "post",
        endpoints.alertPhoneRequest,
        { phone: form.phone },
        true,
        false,
        false,
        false
      );
      toast.success("Verification code sent (WhatsApp if configured, else email).");
    } catch (error) {
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
        <p className="mt-3 text-sm">
          Response organization?{" "}
          <Link to="/app/responder" className="text-primary font-medium">
            Open RapidBrief Desk
          </Link>{" "}
          or{" "}
          <Link to="/app/responder/apply" className="text-primary font-medium">
            apply as a responder
          </Link>
          .
        </p>
      </header>

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
            {form.phone_verified ? "Phone verified." : "Phone not verified yet."}
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
