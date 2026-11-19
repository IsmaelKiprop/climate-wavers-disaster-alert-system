import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import PlantingProofMediaCarousel, {
  proofMediaFromArrays,
} from "../components/PlantingProofMediaCarousel";
import { endpoints } from "../utils/endpoints";
import { apiUrl } from "../config/env";
import { downloadPlasticCertificatePdf } from "../utils/plasticCertificatePdf";

const VerifyPlasticCertificate = () => {
  const { code: pathCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (pathCode || searchParams.get("code") || "").trim();
  const [input, setInput] = useState(initial);
  const [loading, setLoading] = useState(Boolean(initial));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const lookupCode = useMemo(
    () => (pathCode || searchParams.get("code") || "").trim(),
    [pathCode, searchParams]
  );

  useEffect(() => {
    if (!lookupCode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setResult(null);
      try {
        const res = await fetch(apiUrl(endpoints.plasticCertificate(lookupCode)));
        const data = await res.json();
        if (!cancelled) {
          if (res.ok && data?.valid && data?.certificate) {
            setResult(data.certificate);
          } else {
            setResult(null);
            setError(data?.detail || "No plastic certificate matches that ID.");
          }
        }
      } catch {
        if (!cancelled) {
          setResult(null);
          setError("No plastic certificate matches that ID.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lookupCode]);

  const onSubmit = (e) => {
    e.preventDefault();
    const next = input.trim();
    if (!next) return;
    navigate(`/verify/plastic/${encodeURIComponent(next)}`);
  };

  const recovery = result?.recovery;

  return (
    <PublicPage
      title="Verify Plastic Certificate"
      description="Confirm a Climate Wavers Plastic Pulse impact certificate."
    >
      <div className="max-w-xl mx-auto space-y-6 py-8 px-4">
        <div className="flex items-center gap-3">
          <BrandLogo imgClassName="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold">Verify Plastic Certificate</h1>
            <p className="text-sm text-muted">Plastic Pulse · Climate Wavers</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            className="flex-1 h-10 px-3 border border-border bg-background"
            placeholder="Certificate code (CW-PL-…)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="h-10 px-4 bg-primary text-white text-sm">
            Verify
          </button>
        </form>

        {loading ? <p className="text-sm text-muted">Checking…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {result ? (
          <div className="border border-border p-4 space-y-3">
            <div className="text-xs uppercase tracking-wide text-primary">Valid certificate</div>
            <div className="text-lg font-medium">{result.code}</div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Kg</dt>
                <dd className="font-medium">{result.kg}</dd>
              </div>
              <div>
                <dt className="text-muted">Holder</dt>
                <dd className="font-medium">{result.holder_name || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Project</dt>
                <dd className="font-medium">
                  {result.project_name}
                  {result.organization_name ? ` · ${result.organization_name}` : ""}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">Issued</dt>
                <dd className="font-medium">
                  {result.issued_at
                    ? new Date(result.issued_at).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={downloading}
                className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
                onClick={() => {
                  try {
                    setDownloading(true);
                    downloadPlasticCertificatePdf(result, { recovery });
                    toast.success("PDF downloaded");
                  } catch (err) {
                    toast.error(err?.message || "Could not create PDF");
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
              {result.project ? (
                <Link
                  to={`/plastic/${result.project}`}
                  className="h-10 px-4 border border-border text-sm inline-flex items-center"
                >
                  View project
                </Link>
              ) : null}
            </div>
            {recovery?.images || recovery?.videos ? (
              <PlantingProofMediaCarousel
                items={proofMediaFromArrays(recovery.images, recovery.videos)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </PublicPage>
  );
};

export default VerifyPlasticCertificate;
