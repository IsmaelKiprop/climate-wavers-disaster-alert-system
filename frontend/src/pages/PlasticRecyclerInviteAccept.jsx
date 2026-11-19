import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import BrandLogo from "../components/BrandLogo";
import { endpoints } from "../utils/endpoints";
import { getAuthToken, getUser } from "../utils/factory";
import { apiUrl } from "../config/env";

async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = { Accept: "application/json" };
  if (auth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
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

const PlasticRecyclerInviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const loggedIn = Boolean(getAuthToken() || user?.id);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const acceptPath = `/plastic/recycler-invite/${encodeURIComponent(token || "")}`;
  const loginHref = `/login?redirect=${encodeURIComponent(acceptPath)}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(acceptPath)}`;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Missing invite token");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api(endpoints.plasticRecyclerInviteDetail(token));
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Invite not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    if (!token || busy) return;
    if (!loggedIn) {
      toast.info("Sign in or create a free account to accept");
      navigate(loginHref);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api(endpoints.plasticRecyclerInviteAccept(token), {
        method: "POST",
        body: {},
        auth: true,
      });
      toast.success(
        data?.already
          ? "Scan access already active"
          : `You're linked as ${data?.recycler?.name || "recycler"}`
      );
      setDone(true);
      setTimeout(() => navigate(data?.scan_path || "/plastic/intake"), 700);
    } catch (err) {
      setError(err.message || "Could not accept invite");
      toast.error(err.message || "Could not accept invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicPage
      title="Recycler scan invite"
      description="Accept a Climate Wavers Plastic Pulse scan-only invite."
    >
      <div className="max-w-md mx-auto space-y-6 py-10 px-4">
        <div className="flex items-center gap-3">
          <BrandLogo imgClassName="h-8 w-auto" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold">
              Plastic Pulse
            </p>
            <h1 className="text-xl font-semibold">Recycler scan invite</h1>
          </div>
        </div>

        <div className="border border-border p-5 space-y-4">
          {loading ? <p className="text-sm text-muted">Checking invite…</p> : null}

          {!loading && preview ? (
            <>
              <div>
                <div className="font-medium text-lg">{preview.recycler_name}</div>
                <p className="text-sm text-muted mt-1">
                  {preview.organization_name
                    ? `Invited by ${preview.organization_name}`
                    : "CBO scan-only invite"}
                  {preview.city ? ` · ${preview.city}` : ""}
                </p>
              </div>

              {preview.valid ? (
                <>
                  <p className="text-sm text-muted">
                    This gives <span className="text-foreground">scan + confirm intake</span>{" "}
                    access only — no project admin, verify queue, or payments.
                  </p>
                  {loggedIn ? (
                    <p className="text-xs text-muted">
                      Signed in as {user?.email || user?.username || "your account"}.
                    </p>
                  ) : (
                    <p className="text-xs text-muted">
                      Create a free Climate Wavers account (or sign in), then accept.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={accept}
                      className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
                    >
                      {busy
                        ? "Accepting…"
                        : loggedIn
                          ? "Accept scan access"
                          : "Sign in to accept"}
                    </button>
                    {!loggedIn ? (
                      <Link
                        to={signupHref}
                        className="h-10 px-4 border border-border text-sm inline-flex items-center"
                      >
                        Create account
                      </Link>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">
                  This invite is {preview.status || "unavailable"}. Ask the CBO to send a new
                  invite.
                </p>
              )}
            </>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {done ? (
            <p className="text-sm text-primary">Opening bag scanner…</p>
          ) : null}

          <Link to="/plastic/intake" className="text-xs underline text-muted inline-block">
            Already linked? Open scanner
          </Link>
        </div>
      </div>
    </PublicPage>
  );
};

export default PlasticRecyclerInviteAccept;
