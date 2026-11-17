import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { ConfirmAction, PageHeader, StatusBadge } from "../shared";
import { getUser } from "../../utils/factory";

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshCounts } = useOutletContext() || {};
  const me = getUser();
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");

  const load = async () => {
    try {
      const data = await client.run("get", endpoints.platformAdminUser(id), {}, true);
      const next = data?.user || null;
      setUser(next);
      setEmailDraft(next?.email || "");
    } catch {
      toast.error("User not found");
      navigate("/app/platform-admin/users");
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const moderate = async (action, value) => {
    setBusy(true);
    try {
      const data = await client.run(
        "post",
        endpoints.platformAdminUserModerate(id),
        { action, value },
        true
      );
      setUser(data?.user || null);
      toast.success("Updated");
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div>
      <PageHeader
        title={user.username}
        subtitle={user.email}
        actions={
          <Link to="/app/platform-admin/users" className="h-10 px-3 border border-border text-sm inline-flex items-center">
            All users
          </Link>
        }
      />
      <div className="border border-border bg-surface p-4 sm:p-5 grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Name</p>
          <p className="mt-1 font-medium">
            {[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Location</p>
          <p className="mt-1">{[user.state, user.country].filter(Boolean).join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Phone</p>
          <p className="mt-1">{user.phone || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-1 items-start">
          <StatusBadge value={user.is_active ? "active" : "inactive"} tone={user.is_active ? "ok" : "bad"} />
          <StatusBadge value={user.is_verified ? "verified" : "unverified"} tone={user.is_verified ? "ok" : "warn"} />
          {user.is_staff ? <StatusBadge value="staff" /> : null}
          {user.is_superuser ? <StatusBadge value="superuser" /> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!user.is_verified ? (
          <ConfirmAction label="Verify email" busy={busy} onConfirm={() => moderate("verify_email")} />
        ) : null}
        <ConfirmAction
          label={user.is_active ? "Deactivate" : "Activate"}
          variant={user.is_active ? "danger" : "primary"}
          busy={busy}
          onConfirm={() => moderate("set_active", !user.is_active)}
        />
        {me?.is_superuser && me?.id !== user.id ? (
          <ConfirmAction
            label={user.is_staff ? "Revoke staff" : "Grant staff"}
            variant="ghost"
            busy={busy}
            onConfirm={() => moderate("set_staff", !user.is_staff)}
          />
        ) : null}
        {me?.id !== user.id ? (
          <ConfirmAction
            label="Delete forever"
            variant="danger"
            confirmLabel="Delete forever"
            busy={busy}
            onConfirm={async () => {
              setBusy(true);
              try {
                await client.run(
                  "post",
                  endpoints.platformAdminUserModerate(id),
                  { action: "delete" },
                  true
                );
                toast.success("User deleted");
                refreshCounts?.();
                navigate("/app/platform-admin/users");
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Delete failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
      </div>
      <form
        className="mt-6 border border-border bg-surface p-4 space-y-3 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const next = emailDraft.trim().toLowerCase();
          if (!next || next === (user.email || "").toLowerCase()) return;
          moderate("set_email", next);
        }}
      >
        <h2 className="text-sm font-semibold">Change login email</h2>
        <p className="text-xs text-muted">
          Updates account login and owned org contact emails (Responder / Tree Admin).
        </p>
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input
            type="email"
            required
            className="mt-1 h-10 w-full px-3 border border-border bg-background"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={
            busy ||
            !emailDraft.trim() ||
            emailDraft.trim().toLowerCase() === (user.email || "").toLowerCase()
          }
          className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save email"}
        </button>
      </form>
    </div>
  );
};

export default UserDetail;
