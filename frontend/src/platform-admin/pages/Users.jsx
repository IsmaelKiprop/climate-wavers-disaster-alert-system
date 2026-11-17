import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminFilters,
  AdminTable,
  ConfirmAction,
  FilterButton,
  FilterInput,
  FilterSelect,
  PageHeader,
  StatusBadge,
  statusTone,
} from "../shared";

const Users = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState({});
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [grantNow, setGrantNow] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [invites, setInvites] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "25", offset: String(offset) });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const data = await client.run(
        "get",
        `${endpoints.platformAdminUsers}?${params}`,
        {},
        true
      );
      setRows((prev) => (offset ? [...prev, ...(data.results || [])] : data.results || []));
      setPage(data);
    } catch {
      toast.error("Could not load users");
    } finally {
      setLoading(false);
    }
  }, [offset, q, status]);

  const loadInvites = useCallback(async () => {
    try {
      const data = await client.run(
        "get",
        `${endpoints.platformAdminInvites}?status=pending&limit=30`,
        {},
        true
      );
      setInvites(data?.results || []);
    } catch {
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const moderate = async (id, action, value) => {
    setBusyId(id);
    try {
      await client.run(
        "post",
        endpoints.platformAdminUserModerate(id),
        { action, value },
        true
      );
      toast.success(action === "delete" ? "User deleted" : "Updated");
      setOffset(0);
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const data = await client.run(
        "post",
        endpoints.platformAdminInvites,
        {
          email: inviteEmail.trim(),
          note: inviteNote.trim(),
          grant_now: grantNow,
        },
        true
      );
      if (data?.granted) {
        toast.success("Staff access granted");
        setOffset(0);
        await load();
      } else {
        toast.success(
          data?.emailed
            ? "Invite sent by email"
            : "Invite created (email may be unavailable — share the accept link)"
        );
        if (data?.invite?.accept_path) {
          try {
            await navigator.clipboard.writeText(
              `${window.location.origin}${data.invite.accept_path}`
            );
            toast.info("Accept link copied");
          } catch {
            /* ignore */
          }
        }
      }
      setInviteEmail("");
      setInviteNote("");
      setGrantNow(false);
      await loadInvites();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async (id) => {
    setBusyId(`inv-${id}`);
    try {
      await client.run("post", endpoints.platformAdminInviteRevoke(id), {}, true);
      toast.success("Invite revoked");
      await loadInvites();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Revoke failed");
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: "user",
      label: "User",
      render: (r) => (
        <div>
          <Link
            className="font-medium text-primary hover:underline"
            to={`/app/platform-admin/users/${r.id}`}
          >
            {r.username}
          </Link>
          <p className="text-xs text-muted">{r.email}</p>
        </div>
      ),
    },
    {
      key: "flags",
      label: "Flags",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge
            value={r.is_active ? "active" : "inactive"}
            tone={r.is_active ? "ok" : "bad"}
          />
          <StatusBadge
            value={r.is_verified ? "verified" : "unverified"}
            tone={r.is_verified ? "ok" : "warn"}
          />
          {r.is_staff ? <StatusBadge value="staff" tone="neutral" /> : null}
        </div>
      ),
    },
    {
      key: "place",
      label: "Place",
      render: (r) => (
        <span className="text-muted">
          {[r.state, r.country].filter(Boolean).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {!r.is_verified ? (
            <ConfirmAction
              label="Verify"
              busy={busyId === r.id}
              onConfirm={() => moderate(r.id, "verify_email")}
            />
          ) : null}
          <ConfirmAction
            label={r.is_active ? "Deactivate" : "Activate"}
            variant={r.is_active ? "danger" : "primary"}
            busy={busyId === r.id}
            onConfirm={() => moderate(r.id, "set_active", !r.is_active)}
          />
          <ConfirmAction
            label="Delete"
            variant="danger"
            confirmLabel="Delete forever"
            busy={busyId === r.id}
            onConfirm={() => moderate(r.id, "delete")}
          />
        </div>
      ),
    },
  ];

  const inviteColumns = [
    {
      key: "email",
      label: "Invite",
      render: (r) => (
        <div>
          <p className="font-medium">{r.email}</p>
          <p className="text-xs text-muted">
            by {r.invited_by || "—"}
            {r.note ? ` · ${r.note}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge
          value={r.is_expired ? "expired" : r.status}
          tone={statusTone(r.is_expired ? "expired" : r.status)}
        />
      ),
    },
    {
      key: "expires",
      label: "Expires",
      render: (r) => (
        <span className="text-xs text-muted">
          {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.accept_path ? (
            <button
              type="button"
              className="h-9 px-2.5 text-xs border border-border"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}${r.accept_path}`
                  );
                  toast.success("Accept link copied");
                } catch {
                  toast.error("Could not copy");
                }
              }}
            >
              Copy link
            </button>
          ) : null}
          <ConfirmAction
            label="Revoke"
            variant="danger"
            busy={busyId === `inv-${r.id}`}
            onConfirm={() => revokeInvite(r.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Search accounts and invite other Platform Admins"
      />

      <section className="border border-border bg-surface p-4 mb-6">
        <h2 className="text-sm font-semibold">Invite Platform Admin</h2>
        <p className="text-xs text-muted mt-1">
          They sign in with that email and accept the invite (or grant immediately if they
          already have an account).
        </p>
        <form onSubmit={sendInvite} className="mt-3 grid sm:grid-cols-2 gap-2">
          <FilterInput
            type="email"
            required
            placeholder="admin@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <FilterInput
            placeholder="Note (optional)"
            value={inviteNote}
            onChange={(e) => setInviteNote(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={grantNow}
              onChange={(e) => setGrantNow(e.target.checked)}
            />
            Grant staff immediately (existing account only)
          </label>
          <FilterButton disabled={inviting} type="submit">
            {inviting ? "Sending…" : grantNow ? "Grant access" : "Send invite"}
          </FilterButton>
        </form>
      </section>

      {invites.length ? (
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-2">Pending invites</h2>
          <AdminTable columns={inviteColumns} rows={invites} empty="No pending invites" />
        </section>
      ) : null}

      <AdminFilters
        className="mb-4"
        onSubmit={() => {
          setOffset(0);
          load();
        }}
      >
        <FilterInput
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="staff">Staff</option>
          <option value="unverified">Unverified</option>
        </FilterSelect>
        <FilterButton
          onClick={() => {
            setOffset(0);
          }}
        >
          Search
        </FilterButton>
      </AdminFilters>
      <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No users"} />
      {page.next_offset != null ? (
        <button
          type="button"
          className="mt-4 h-10 px-4 border border-border text-sm"
          disabled={loading}
          onClick={() => setOffset(page.next_offset)}
        >
          Load more
        </button>
      ) : null}
    </div>
  );
};

export default Users;
