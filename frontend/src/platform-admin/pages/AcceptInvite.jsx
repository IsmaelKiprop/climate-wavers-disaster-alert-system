import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { getUser, isPlatformStaff, setUser } from "../../utils/factory";

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = (params.get("token") || "").trim();
  const navigate = useNavigate();
  const user = getUser();
  const [status, setStatus] = useState(token ? "ready" : "missing");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!token) return;
    if (isPlatformStaff()) {
      setStatus("already");
    }
  }, [token]);

  const accept = async () => {
    if (!token || busy) return;
    if (!user?.id) {
      toast.info("Sign in with the invited email first");
      navigate(`/login?next=${encodeURIComponent(`/app/platform-admin/accept-invite?token=${token}`)}`);
      return;
    }
    setBusy(true);
    try {
      const data = await client.run(
        "post",
        endpoints.platformAdminInviteAccept,
        { token },
        true
      );
      try {
        setUser({ ...getUser(), is_staff: true, is_verified: true });
      } catch {
        /* ignore */
      }
      toast.success(data?.already ? "Already accepted" : "You are now a Platform Admin");
      setStatus("done");
      setTimeout(() => navigate("/app/platform-admin"), 800);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Could not accept invite";
      setDetail(msg);
      setStatus("error");
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-border bg-surface p-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
          Platform Admin
        </p>
        <h1 className="mt-2 text-xl font-semibold">Accept invite</h1>

        {status === "missing" ? (
          <p className="mt-3 text-sm text-muted">No invite token in this link.</p>
        ) : null}

        {status === "already" ? (
          <>
            <p className="mt-3 text-sm text-muted">You already have Platform Admin access.</p>
            <Link
              to="/app/platform-admin"
              className="mt-5 inline-flex h-10 px-4 bg-primary text-primary-foreground text-sm font-medium items-center"
            >
              Open Platform Admin
            </Link>
          </>
        ) : null}

        {status === "ready" || status === "error" ? (
          <>
            <p className="mt-3 text-sm text-muted">
              {user?.email
                ? `Signed in as ${user.email}. Accept to gain staff access.`
                : "Sign in with the invited email, then accept."}
            </p>
            {detail ? <p className="mt-2 text-sm text-destructive">{detail}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={accept}
              className="mt-5 h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "Accepting…" : "Accept invite"}
            </button>
          </>
        ) : null}

        {status === "done" ? (
          <p className="mt-3 text-sm text-primary font-medium">Redirecting to Platform Admin…</p>
        ) : null}
      </div>
    </div>
  );
};

export default AcceptInvite;
