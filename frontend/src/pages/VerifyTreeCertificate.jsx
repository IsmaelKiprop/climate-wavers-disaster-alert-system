import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { SITE } from "../config/site";

const VerifyTreeCertificate = () => {
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
          endpoints.treesCertificateVerify(lookupCode),
          {},
          false
        );
        if (!cancelled) {
          if (data?.valid && data?.certificate) {
            setResult(data.certificate);
          } else {
            setResult(null);
            setError(data?.detail || "No tree certificate matches that ID.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setError(
            err?.response?.data?.detail ||
              "No tree certificate matches that ID."
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
    const next = input.trim();
    if (!next) return;
    navigate(`/verify/tree/${encodeURIComponent(next)}`);
  };

  return (
    <PublicPage
      title="Verify Tree Certificate"
      description="Confirm a Climate Wavers tree plantation certificate ID."
    >
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <div className="flex items-center gap-3 mb-8">
          <BrandLogo imgClassName="h-10 w-auto" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary font-semibold">
              Climate Wavers
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Verify tree certificate
            </h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="border border-border bg-surface p-4 sm:p-5 mb-8">
          <label htmlFor="tree-cert-code" className="text-sm font-medium text-foreground">
            Certificate ID
          </label>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input
              id="tree-cert-code"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="CW-…"
              className="flex-1 h-11 border border-border bg-background px-3 text-sm font-mono"
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
            Scan the QR on a certificate or enter the ID to confirm it was issued by {SITE.name}.
          </p>
        </form>

        {loading ? <p className="text-sm text-muted">Checking…</p> : null}

        {!loading && error ? (
          <div className="border border-border p-5 bg-surface">
            <p className="text-sm font-semibold text-destructive">Not found</p>
            <p className="text-sm text-muted mt-1">{error}</p>
          </div>
        ) : null}

        {!loading && result ? (
          <div className="border-[3px] border-primary bg-surface p-5 sm:p-7">
            <p className="text-[11px] uppercase tracking-[0.22em] text-primary font-semibold">
              Valid plantation certificate
            </p>
            <p className="mt-4 text-sm text-muted">Awarded to</p>
            <p className="text-lg sm:text-xl font-semibold text-primary">
              {result.donor_name}
            </p>
            {result.gifted_to ? (
              <p className="text-sm text-muted mt-1">Gifted to {result.gifted_to}</p>
            ) : null}

            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-border pt-5">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Certificate ID</dt>
                <dd className="font-mono font-medium mt-1 break-all">{result.certificate_id}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Issued</dt>
                <dd className="font-medium mt-1">{result.issued_on || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Trees</dt>
                <dd className="font-medium mt-1">
                  {result.trees} · {result.species}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Project</dt>
                <dd className="font-medium mt-1">
                  {result.project_name}
                  {result.location ? ` · ${result.location}` : ""}
                </dd>
              </div>
              {result.organization_name ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-muted">Host</dt>
                  <dd className="font-medium mt-1">{result.organization_name}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">CO₂ / year</dt>
                <dd className="font-medium mt-1">~{Math.round(result.co2_kg_year || 0)} kg</dd>
              </div>
            </dl>
          </div>
        ) : null}

        <p className="mt-8 text-sm text-muted">
          <Link to="/plant-tree" className="text-primary hover:underline">
            Plant a tree
          </Link>
          {" · "}
          <Link to="/verify/champion" className="text-primary hover:underline">
            Verify Champion certificate
          </Link>
        </p>
      </div>
    </PublicPage>
  );
};

export default VerifyTreeCertificate;
