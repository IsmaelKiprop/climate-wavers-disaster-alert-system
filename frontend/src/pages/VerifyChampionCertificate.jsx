import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { SITE } from "../config/site";

const VerifyChampionCertificate = () => {
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
        const data = await client.run(
          "get",
          endpoints.championsCertificateVerify(lookupCode),
          {},
          false
        );
        if (!cancelled) setResult(data?.certificate || null);
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setError(
            err?.response?.data?.detail ||
              "No Community Champion certificate matches that code."
          );
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
    const next = input.trim().toUpperCase();
    if (!next) return;
    navigate(`/verify/champion/${encodeURIComponent(next)}`);
  };

  const issued = result?.issued_at
    ? new Date(result.issued_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <PublicPage
      title="Verify Champion Certificate"
      description="Confirm a Climate Wavers Community Champion training certificate ID."
    >
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-8">
          <BrandLogo imgClassName="h-10 w-auto" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">
              Climate Wavers
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Verify certificate
            </h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="border border-border bg-surface p-4 sm:p-5 mb-8">
          <label htmlFor="cert-code" className="text-sm font-medium text-foreground">
            Certificate ID
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              id="cert-code"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="CW-CHAMP-…"
              className="flex-1 h-11 border border-border bg-background px-3 text-sm font-mono"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              type="submit"
              className="h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold"
            >
              Verify
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            Anyone can check a Community Champion certificate issued by {SITE.name}.
          </p>
        </form>

        {loading ? (
          <p className="text-sm text-muted">Checking…</p>
        ) : null}

        {!loading && error ? (
          <div className="border border-border p-5 bg-surface">
            <p className="text-sm font-semibold text-destructive">Not found</p>
            <p className="text-sm text-muted mt-1">{error}</p>
          </div>
        ) : null}

        {!loading && result?.valid ? (
          <div className="border-[3px] border-primary bg-surface p-5 sm:p-7">
            <p className="text-[11px] uppercase tracking-[0.22em] text-primary font-semibold">
              Valid certificate
            </p>
            <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-foreground">
              {result.program}
            </h2>
            <p className="mt-4 text-sm text-muted">Issued to</p>
            <p className="text-lg sm:text-xl font-semibold text-primary">
              {result.holder_name}
            </p>
            {result.affiliation ? (
              <p className="text-sm text-muted mt-1">{result.affiliation}</p>
            ) : null}
            {result.territory ? (
              <p className="text-sm text-muted">{result.territory}</p>
            ) : null}

            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-border pt-5">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  Certificate ID
                </dt>
                <dd className="font-mono font-medium mt-1 break-all">
                  {result.certificate_code}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  Issued
                </dt>
                <dd className="font-medium mt-1">{issued || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  Modules
                </dt>
                <dd className="font-medium mt-1">
                  {result.modules_completed}/{result.modules_total} passed (quiz ≥ 70%)
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  Tier
                </dt>
                <dd className="font-medium mt-1 capitalize">{result.tier}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  Issuer
                </dt>
                <dd className="font-medium mt-1">
                  {result.issuer} · {result.org}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <p className="mt-8 text-sm text-muted">
          <Link to="/champions" className="text-primary hover:underline">
            Community Champions directory
          </Link>
          {" · "}
          <Link to="/champions/apply" className="text-primary hover:underline">
            Become a Champion
          </Link>
        </p>
      </div>
    </PublicPage>
  );
};

export default VerifyChampionCertificate;
