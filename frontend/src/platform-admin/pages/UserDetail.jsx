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

  const load = async () => {
    try {
      const data = await client.run("get", endpoints.platformAdminUser(id), {}, true);
      setUser(data?.user || null);
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
      </div>
    </div>
  );
};

export default UserDetail;
