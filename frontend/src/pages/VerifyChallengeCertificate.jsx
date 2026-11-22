import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import { endpoints } from "../utils/endpoints";
import { apiUrl } from "../config/env";

const VerifyChallengeCertificate = () => {
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
        const res = await fetch(
          apiUrl(endpoints.challengeCertificate(lookupCode))
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (res.ok && data?.certificate_id) {
            setResult(data);
          } else {
            setResult(null);
            setError(
              data?.detail || "No challenge certificate matches that ID."
            );
          }
        }
      } catch {
        if (!cancelled) {
          setResult(null);
          setError("No challenge certificate matches that ID.");
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
    navigate(`/verify/challenge/${encodeURIComponent(next)}`);
  };

  const group = result?.participation?.group;
  const challenge = result?.challenge;

  return (
    <PublicPage
      title="Verify Challenge Certificate"
      description="Confirm a Climate Wavers seasonal challenge certificate."
    >
      <div className="max-w-4xl mx-auto space-y-6 py-8 px-4">
        <div className="flex items-center gap-3">
          <BrandLogo imgClassName="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold">Verify Challenge Certificate</h1>
            <p className="text-sm text-muted">Seasonal challenges · Climate Wavers</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 max-w-xl">
          <input
            className="flex-1 h-10 px-3 border border-border bg-background"
            placeholder="Certificate code (CW-CHAL-…)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 px-4 bg-primary text-white text-sm"
          >
            Verify
          </button>
        </form>

        {loading ? <p className="text-sm text-muted">Checking…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {result ? (
          <div className="border border-border bg-surface p-5 space-y-4">
            <div className="text-xs uppercase tracking-wide text-primary font-semibold">
              Valid certificate
            </div>
            <div>
              <p className="text-sm text-muted">Certificate ID</p>
              <p className="font-semibold text-foreground font-mono">
                {result.certificate_id}
              </p>
            </div>
            {challenge ? (
              <div>
                <p className="text-sm text-muted">Challenge</p>
                <p className="font-medium text-foreground">{challenge.title}</p>
                <p className="text-sm text-muted">
                  {[challenge.county, challenge.metric]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ) : null}
            {group ? (
              <div>
                <p className="text-sm text-muted">Group</p>
                <Link
                  to={`/groups/${group.id}`}
                  className="font-medium text-primary"
                >
                  {group.name}
                </Link>
                <p className="text-sm text-muted mt-1">
                  Rank {result.participation?.rank || "—"} · score{" "}
                  {Number(result.participation?.score || 0)}
                </p>
              </div>
            ) : null}
            {result.issued_at ? (
              <p className="text-sm text-muted">
                Issued {new Date(result.issued_at).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </PublicPage>
  );
};

export default VerifyChallengeCertificate;
