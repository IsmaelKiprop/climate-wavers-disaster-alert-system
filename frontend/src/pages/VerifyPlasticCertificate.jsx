import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import PlasticCertificate from "../components/PlasticCertificate";
import PlantingProofMediaCarousel, {
  proofMediaFromArrays,
} from "../components/PlantingProofMediaCarousel";
import { endpoints } from "../utils/endpoints";
import { apiUrl } from "../config/env";

const VerifyPlasticCertificate = () => {
  const { code: pathCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initial = (pathCode || searchParams.get("code") || "").trim();
  const [input, setInput] = useState(initial);
  const [loading, setLoading] = useState(Boolean(initial));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
      <div className="max-w-4xl mx-auto space-y-6 py-8 px-4">
        <div className="flex items-center gap-3">
          <BrandLogo imgClassName="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold">Verify Plastic Certificate</h1>
            <p className="text-sm text-muted">Plastic Pulse · Climate Wavers</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 max-w-xl">
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
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wide text-primary font-semibold">
              Valid certificate
            </div>
            <PlasticCertificate certificate={result} recovery={recovery} />
            {result.project ? (
              <div className="flex justify-center">
                <Link
                  to={`/plastic/${result.project}`}
                  className="h-10 px-4 border border-border text-sm inline-flex items-center"
                >
                  View project
                </Link>
              </div>
            ) : null}
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
