import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminFilters,
  AdminTable,
  ConfirmAction,
  DetailField,
  DetailPanel,
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
  const [selectedId, setSelectedId] = useState(null);

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
        const next = data?.results || [];
        setRows(next);
        setSelectedId((prev) => (prev && next.some((r) => r.id === prev) ? prev : next[0]?.id ?? null));
      } else {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("status", status);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminCameras}?${params}`,
          {},
          true
        );
        const next = data?.results || [];
        setRows(next);
        setSelectedId((prev) => (prev && next.some((r) => r.id === prev) ? prev : next[0]?.id ?? null));
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

  const selected = rows.find((r) => r.id === selectedId) || null;

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
        <button type="button" onClick={() => setSelectedId(r.id)} className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}>
          <p className="font-medium">{r.display_name}</p>
          <p className="text-xs text-muted">
            {r.email} · {[r.city, r.country].filter(Boolean).join(", ")}
          </p>
          {r.phone ? <p className="text-[11px] text-muted mt-0.5">{r.phone}</p> : null}
        </button>
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
          <button type="button" onClick={() => setSelectedId(r.id)} className="h-9 px-2.5 text-xs border border-border">
            Details
          </button>
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
        </div>
      ),
    },
  ];

  const cameraColumns = [
    {
      key: "name",
      label: "Camera",
      render: (r) => (
        <button type="button" onClick={() => setSelectedId(r.id)} className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.latitude}, {r.longitude}
          </p>
          {r.champion_name ? <p className="text-[11px] text-muted mt-0.5">{r.champion_name}</p> : null}
        </button>
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
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setSelectedId(r.id)} className="h-9 px-2.5 text-xs border border-border">
            Details
          </button>
          {r.status === "pending" ? (
            <ConfirmAction label="Activate" busy={busyId === r.id} onConfirm={() => activateCamera(r.id)} />
          ) : null}
        </div>
      ),
    },
  ];

  const championDetail = selected && tab === "champions" ? (
    <DetailPanel
      title={selected.display_name}
      subtitle={`ID #${selected.id}${selected.user_id ? ` · user #${selected.user_id}` : ""}`}
      badge={<StatusBadge value={selected.status} tone={statusTone(selected.status)} />}
      actions={
        <>
          {selected.status === "pending" ? (
            <>
              <ConfirmAction label="Approve" busy={busyId === selected.id} onConfirm={() => moderate(selected.id, "approve")} />
              <ConfirmAction label="Reject" variant="danger" busy={busyId === selected.id} onConfirm={() => moderate(selected.id, "reject")} />
            </>
          ) : null}
          {selected.status === "active" ? (
            <ConfirmAction label="Suspend" variant="danger" busy={busyId === selected.id} onConfirm={() => moderate(selected.id, "suspend")} />
          ) : null}
          {selected.status === "suspended" ? (
            <ConfirmAction label="Re-approve" busy={busyId === selected.id} onConfirm={() => moderate(selected.id, "approve")} />
          ) : null}
          <ConfirmAction
            label="Tier: trusted"
            variant="ghost"
            busy={busyId === selected.id}
            onConfirm={() => moderate(selected.id, "set_tier", { tier: "trusted" })}
          />
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <DetailField label="Email">{selected.email}</DetailField>
        <DetailField label="Username">{selected.username}</DetailField>
        <DetailField label="Phone">{selected.phone || selected.user_phone || "—"}</DetailField>
        <DetailField label="Affiliation">{selected.affiliation || "—"}</DetailField>
        <DetailField label="Languages">{selected.languages || "—"}</DetailField>
        <DetailField label="Sponsor">{selected.sponsor_name || "—"}</DetailField>
        <DetailField label="Location">
          {[selected.ward, selected.city, selected.region, selected.country].filter(Boolean).join(", ") || "—"}
        </DetailField>
        <DetailField label="Coverage radius">{selected.radius_km != null ? `${selected.radius_km} km` : "—"}</DetailField>
        <DetailField label="Coordinates">
          {selected.latitude != null && selected.longitude != null
            ? `${selected.latitude}, ${selected.longitude}`
            : "—"}
        </DetailField>
        <DetailField label="Map">
          {selected.latitude != null && selected.longitude != null ? (
            <a
              className="text-primary hover:underline"
              href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          ) : (
            "—"
          )}
        </DetailField>
        <DetailField label="Training">{`${selected.training_passed}/7`}{selected.trained_at ? ` · trained ${new Date(selected.trained_at).toLocaleDateString()}` : ""}</DetailField>
        <DetailField label="Certificate">
          {selected.certificate_code ? (
            <Link to={`/verify/champion/${selected.certificate_code}`} className="text-primary font-mono hover:underline">
              {selected.certificate_code}
            </Link>
          ) : (
            "Not issued"
          )}
        </DetailField>
        <DetailField label="Impact">
          score {selected.impact_score} · ★ {selected.rating_avg} ({selected.rating_count}) · {selected.verifications_count} verifies · {selected.enrollments_count} enrolled · {selected.proximity_blasts_count} blasts
        </DetailField>
        <DetailField label="Last check-in">
          {selected.last_check_in_at ? new Date(selected.last_check_in_at).toLocaleString() : "Never"}
        </DetailField>
        <DetailField label="Applied">
          {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
        </DetailField>
        <DetailField label="Approved">
          {selected.approved_at ? new Date(selected.approved_at).toLocaleString() : "—"}
        </DetailField>
      </div>
      {selected.bio ? (
        <div className="border-t border-border pt-4">
          <DetailField label="Bio">{selected.bio}</DetailField>
        </div>
      ) : null}
      {Array.isArray(selected.relay_nodes) && selected.relay_nodes.length ? (
        <div className="border-t border-border pt-4">
          <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Relay nodes</p>
          <ul className="text-sm space-y-1">
            {selected.relay_nodes.map((n, i) => (
              <li key={i} className="text-muted">
                <span className="text-foreground">{n.name || "Contact"}</span>
                {n.role ? ` · ${n.role}` : ""}
                {n.phone ? ` · ${n.phone}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DetailPanel>
  ) : null;

  const cameraDetail = selected && tab === "cameras" ? (
    <DetailPanel
      title={selected.name}
      subtitle={`ID #${selected.id}`}
      badge={<StatusBadge value={selected.status} tone={statusTone(selected.status)} />}
      actions={
        selected.status === "pending" ? (
          <ConfirmAction label="Activate" busy={busyId === selected.id} onConfirm={() => activateCamera(selected.id)} />
        ) : null
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <DetailField label="Stream type">{selected.stream_type}</DetailField>
        <DetailField label="Coverage">{selected.coverage_radius_m != null ? `${selected.coverage_radius_m} m` : "—"}</DetailField>
        <DetailField label="Coordinates">
          {selected.latitude != null && selected.longitude != null
            ? `${selected.latitude}, ${selected.longitude}`
            : "—"}
        </DetailField>
        <DetailField label="Map">
          {selected.latitude != null && selected.longitude != null ? (
            <a
              className="text-primary hover:underline"
              href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps
            </a>
          ) : (
            "—"
          )}
        </DetailField>
        <DetailField label="Stream URL">
          {selected.stream_url ? (
            <a className="text-primary hover:underline break-all" href={selected.stream_url} target="_blank" rel="noreferrer">
              {selected.stream_url}
            </a>
          ) : (
            "—"
          )}
        </DetailField>
        <DetailField label="Retention">{selected.retention_days != null ? `${selected.retention_days} days` : "—"}</DetailField>
        <DetailField label="NVR sync">{selected.nvr_sync_enabled ? "Enabled" : "Off"}</DetailField>
        <DetailField label="Champion">{selected.champion_name || (selected.champion_id ? `#${selected.champion_id}` : "—")}</DetailField>
        <DetailField label="Responder org">{selected.responder_org_name || "—"}</DetailField>
        <DetailField label="Submitted by">{selected.created_by_email || "—"}</DetailField>
        <DetailField label="Created">
          {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
        </DetailField>
        <DetailField label="Last seen">
          {selected.last_seen_at ? new Date(selected.last_seen_at).toLocaleString() : "—"}
        </DetailField>
      </div>
      {selected.consent_note ? (
        <div className="border-t border-border pt-4">
          <DetailField label="Consent note">{selected.consent_note}</DetailField>
        </div>
      ) : null}
    </DetailPanel>
  ) : null;

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
              setStatus("pending");
              setSelectedId(null);
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
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
        <AdminTable
          columns={tab === "champions" ? championColumns : cameraColumns}
          rows={rows}
          empty={loading ? "Loading…" : "No rows"}
        />
        {tab === "champions" ? championDetail || <DetailPanel empty="Select a champion to review the full application." /> : null}
        {tab === "cameras" ? cameraDetail || <DetailPanel empty="Select a camera to review stream and consent details." /> : null}
      </div>
    </div>
  );
};

export default Champions;
