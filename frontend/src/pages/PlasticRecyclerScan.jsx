import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import PlasticBagQrCard from "../components/PlasticBagQrCard";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { apiUrl } from "../config/env";
import { parseBagIdFromScan } from "../utils/plasticBagQr";

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

const PlasticRecyclerScan = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBag = parseBagIdFromScan(searchParams.get("bag") || "") || "";

  const [bagInput, setBagInput] = useState(initialBag);
  const [bagId, setBagId] = useState(initialBag);
  const [recovery, setRecovery] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialBag));
  const [error, setError] = useState("");
  const [kg, setKg] = useState("");
  const [recyclerId, setRecyclerId] = useState("");
  const [recyclers, setRecyclers] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanHint, setScanHint] = useState("");
  const [me, setMe] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const lastScanRef = useRef("");

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    setScanning(false);
  }, []);

  const applyBag = useCallback(
    (raw) => {
      const parsed = parseBagIdFromScan(raw);
      if (!parsed) {
        toast.error("Could not read a Bag ID from that scan");
        return;
      }
      setBagInput(parsed);
      setBagId(parsed);
      setResult(null);
      setSearchParams(parsed ? { bag: parsed } : {}, { replace: true });
    },
    [setSearchParams]
  );

  const loadBag = useCallback(async (id) => {
    const bag = String(id || "").trim();
    if (!bag) {
      setRecovery(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api(endpoints.plasticBag(bag));
      setRecovery(data);
      setKg(
        data.kg_verified != null && data.kg_verified !== ""
          ? String(data.kg_verified)
          : String(data.kg_claimed || "")
      );
      if (data.scanner_recycler_id) {
        setRecyclerId(String(data.scanner_recycler_id));
      }
    } catch (err) {
      setRecovery(null);
      setError(err.message || "Bag not found");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBag(bagId);
  }, [bagId, loadBag]);

  useEffect(() => {
    api(endpoints.plasticRecyclerMe)
      .then((data) => setMe(data))
      .catch(() => setMe(null));
    api(endpoints.plasticRecyclers)
      .then((data) => setRecyclers(Array.isArray(data) ? data : []))
      .catch(() => setRecyclers([]));
    return () => stopCamera();
  }, [stopCamera]);

  const scanOnly = Boolean(me?.scan_only);
  const partnerName = me?.partners?.[0]?.name;

  const startCamera = async () => {
    setScanHint("");
    setError("");
    if (!("BarcodeDetector" in window)) {
      setScanHint(
        "This browser can’t scan in-app. Use your phone camera on the bag QR, or type the Bag ID."
      );
      return;
    }
    try {
      const Detector = window.BarcodeDetector;
      detectorRef.current = new Detector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      const tick = async () => {
        if (!detectorRef.current || !videoRef.current) return;
        try {
          const codes = await detectorRef.current.detect(videoRef.current);
          if (codes?.length) {
            const raw = codes[0].rawValue || "";
            if (raw && raw !== lastScanRef.current) {
              lastScanRef.current = raw;
              const parsed = parseBagIdFromScan(raw);
              if (parsed) {
                toast.success(`Scanned ${parsed}`);
                stopCamera();
                applyBag(parsed);
                return;
              }
            }
          }
        } catch {
          /* keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setScanHint(err?.message || "Camera permission denied");
      stopCamera();
    }
  };

  const onManualLookup = (e) => {
    e.preventDefault();
    applyBag(bagInput);
  };

  const confirmIntake = async () => {
    if (!bagId || confirming) return;
    setConfirming(true);
    try {
      const data = await api(endpoints.plasticIntakeScan, {
        method: "POST",
        body: {
          bag_id: bagId,
          kg_verified: kg || undefined,
          recycler_id: recyclerId || undefined,
        },
      });
      setResult(data);
      setRecovery(data);
      toast.success(
        `Intake confirmed${data.certificate_code ? ` · ${data.certificate_code}` : ""}`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirming(false);
    }
  };

  const canIntake =
    recovery &&
    (recovery.can_intake ||
      recovery.status === "cbo_verified" ||
      recovery.status === "submitted");

  return (
    <PublicPage
      title="Recycler intake scan"
      description="Scan a Plastic Pulse bag QR to confirm recycler intake."
    >
      <div className="max-w-lg mx-auto space-y-6 py-8 px-4">
        <div className="flex items-center gap-3">
          <BrandLogo imgClassName="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold">Recycler QR intake</h1>
            <p className="text-sm text-muted">
              {scanOnly && partnerName
                ? `${partnerName} · scan-only access`
                : "Scan bag → confirm kg → close chain of custody"}
            </p>
          </div>
        </div>

        <div className="space-y-3 border border-border p-4">
          <div className="flex flex-wrap gap-2">
            {!scanning ? (
              <button
                type="button"
                onClick={startCamera}
                className="h-10 px-4 bg-primary text-white text-sm"
              >
                Scan with camera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="h-10 px-4 border border-border text-sm"
              >
                Stop camera
              </button>
            )}
            {!scanOnly ? (
              <Link
                to="/app/admin/plastic"
                className="h-10 px-4 border border-border text-sm inline-flex items-center"
              >
                Plastic admin
              </Link>
            ) : null}
          </div>
          {scanHint ? <p className="text-xs text-amber-600 dark:text-amber-300">{scanHint}</p> : null}
          {scanning ? (
            <video
              ref={videoRef}
              className="w-full aspect-square object-cover bg-black"
              playsInline
              muted
            />
          ) : null}
        </div>

        <form onSubmit={onManualLookup} className="space-y-2 border border-border p-4">
          <label className="text-xs font-medium">Bag ID</label>
          <div className="flex gap-2">
            <input
              className="flex-1 h-10 px-3 border border-border bg-background"
              value={bagInput}
              onChange={(e) => setBagInput(e.target.value.toUpperCase())}
              placeholder="BAG-…"
            />
            <button type="submit" className="h-10 px-4 border border-border text-sm">
              Look up
            </button>
          </div>
        </form>

        {loading ? <p className="text-sm text-muted">Looking up bag…</p> : null}
        {error && !loading ? <p className="text-sm text-red-600">{error}</p> : null}

        {recovery && !loading ? (
          <div className="space-y-4 border border-border p-4">
            <div>
              <div className="font-medium text-lg">{recovery.bag_id}</div>
              <p className="text-sm text-muted">
                {recovery.project_name || `Project #${recovery.project}`} ·{" "}
                {recovery.polymer_type} · status: {recovery.status}
              </p>
              <p className="text-sm mt-1">
                Claimed {recovery.kg_claimed} kg
                {recovery.kg_verified ? ` · verified ${recovery.kg_verified} kg` : ""}
              </p>
            </div>

            {result?.status === "intake_confirmed" || recovery.status === "intake_confirmed" ? (
              <div className="space-y-2">
                <p className="text-sm text-primary font-medium">Intake already confirmed.</p>
                {(result?.certificate_code || recovery.certificate_code) && (
                  <p className="text-sm">
                    Certificate:{" "}
                    <Link
                      className="underline"
                      to={`/verify/plastic/${encodeURIComponent(
                        result?.certificate_code || recovery.certificate_code
                      )}`}
                    >
                      {result?.certificate_code || recovery.certificate_code}
                    </Link>
                  </p>
                )}
                <PlasticBagQrCard
                  bagId={recovery.bag_id}
                  kg={recovery.kg_verified || recovery.kg_claimed}
                  polymerType={recovery.polymer_type}
                  status={recovery.status}
                  compact
                />
              </div>
            ) : canIntake ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">
                    Confirmed kg <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="w-full h-10 px-3 border border-border bg-background"
                    value={kg}
                    onChange={(e) => setKg(e.target.value)}
                    required
                  />
                </div>
                {!scanOnly ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Recycler <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <select
                      className="w-full h-10 px-3 border border-border bg-background"
                      value={recyclerId}
                      onChange={(e) => setRecyclerId(e.target.value)}
                    >
                      <option value="">No recycler selected</option>
                      {recyclers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Intake will be recorded as {partnerName || "your recycler yard"}.
                  </p>
                )}
                <button
                  type="button"
                  disabled={confirming || !(Number(kg) > 0)}
                  onClick={confirmIntake}
                  className="w-full h-11 bg-primary text-white text-sm disabled:opacity-60"
                >
                  {confirming ? "Confirming…" : "Confirm recycler intake"}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted">
                This bag can’t be intaken yet (status: {recovery.status}).
              </p>
            )}
          </div>
        ) : null}

        {!bagId && !loading ? (
          <p className="text-sm text-muted">
            Point your phone camera at a bag QR, or enter a Bag ID above. QR stickers open this
            page automatically.
          </p>
        ) : null}
      </div>
    </PublicPage>
  );
};

export default PlasticRecyclerScan;
