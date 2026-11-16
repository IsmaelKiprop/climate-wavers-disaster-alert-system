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

const Champions = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [tab, setTab] = useState("champions");
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "champions") {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("status", status);
        if (q) params.set("q", q);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminChampions}?${params}`,
          {},
          true
        );
        setRows(data?.results || []);
      } else {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("status", status);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminCameras}?${params}`,
          {},
          true
        );
        setRows(data?.results || []);
      }
    } catch {
      toast.error("Could not load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (id, action, extra = {}) => {
    setBusyId(id);
    try {
      await client.run(
        "post",
        endpoints.platformAdminChampionModerate(id),
        { action, ...extra },
        true
      );
      toast.success("Updated");
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const activateCamera = async (id) => {
    setBusyId(id);
    try {
      await client.run("post", endpoints.platformAdminCameraActivate(id), {}, true);
      toast.success("Camera activated");
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const championColumns = [
    {
      key: "name",
      label: "Champion",
      render: (r) => (
        <div>
          <p className="font-medium">{r.display_name}</p>
          <p className="text-xs text-muted">
            {r.email} · {[r.city, r.country].filter(Boolean).join(", ")}
          </p>
          {r.certificate_code ? (
            <Link
              to={`/verify/champion/${r.certificate_code}`}
              className="text-[11px] text-primary font-mono hover:underline"
            >
              {r.certificate_code}
            </Link>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge value={r.status} tone={statusTone(r.status)} />
          <StatusBadge value={r.tier} />
          <StatusBadge value={`train ${r.training_passed}/7`} tone={r.training_passed >= 7 ? "ok" : "warn"} />
        </div>
      ),
    },
    {
      key: "impact",
      label: "Impact",
      render: (r) => (
        <span className="text-muted text-xs">
          score {r.impact_score} · ★ {r.rating_avg} · {r.verifications_count} verifies
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.status === "pending" ? (
            <>
              <ConfirmAction label="Approve" busy={busyId === r.id} onConfirm={() => moderate(r.id, "approve")} />
              <ConfirmAction label="Reject" variant="danger" busy={busyId === r.id} onConfirm={() => moderate(r.id, "reject")} />
            </>
          ) : null}
          {r.status === "active" ? (
            <ConfirmAction label="Suspend" variant="danger" busy={busyId === r.id} onConfirm={() => moderate(r.id, "suspend")} />
          ) : null}
          {r.status === "suspended" ? (
            <ConfirmAction label="Re-approve" busy={busyId === r.id} onConfirm={() => moderate(r.id, "approve")} />
          ) : null}
          <ConfirmAction
            label="Tier: trusted"
            variant="ghost"
            busy={busyId === r.id}
            onConfirm={() => moderate(r.id, "set_tier", { tier: "trusted" })}
          />
        </div>
      ),
    },
  ];

  const cameraColumns = [
    {
      key: "name",
      label: "Camera",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.latitude}, {r.longitude}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge value={r.status} tone={statusTone(r.status)} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        r.status === "pending" ? (
          <ConfirmAction label="Activate" busy={busyId === r.id} onConfirm={() => activateCamera(r.id)} />
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Champions" subtitle="Applications, tiers, certificates, partner cameras" />
      <div className="flex gap-2 mb-4">
        {[
          ["champions", "Champions"],
          ["cameras", "Cameras"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              setStatus(id === "champions" ? "pending" : "pending");
            }}
            className={`h-9 px-3 text-sm border ${
              tab === id ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <AdminFilters className="mb-4" onSubmit={load}>
        {tab === "champions" ? (
          <FilterInput placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        ) : null}
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          {tab === "champions" ? <option value="suspended">Suspended</option> : null}
          {tab === "champions" ? <option value="rejected">Rejected</option> : null}
          {tab === "cameras" ? <option value="offline">Offline</option> : null}
        </FilterSelect>
        <FilterButton>Search</FilterButton>
      </AdminFilters>
      <AdminTable
        columns={tab === "champions" ? championColumns : cameraColumns}
        rows={rows}
        empty={loading ? "Loading…" : "No rows"}
      />
    </div>
  );
};

export default Champions;
