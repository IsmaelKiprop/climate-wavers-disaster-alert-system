import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminFilters,
  AdminTable,
  ConfirmAction,
  DetailField,
  FilterButton,
  FilterInput,
  FilterSelect,
  PageHeader,
  StatusBadge,
  statusTone,
} from "../shared";

const Responders = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      const data = await client.run(
        "get",
        `${endpoints.platformAdminResponders}?${params}`,
        {},
        true
      );
      const next = data?.results || [];
      setRows(next);
      setSelectedId((prev) => {
        if (prev && next.some((r) => r.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    } catch {
      toast.error("Could not load responders");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) || null;

  const moderate = async (id, action) => {
    setBusyId(id);
    try {
      await client.run(
        "post",
        endpoints.platformAdminResponderModerate(id),
        { action },
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

  const columns = [
    {
      key: "name",
      label: "Organization",
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedId(r.id)}
          className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}
        >
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.org_type} · {r.contact_email || "—"} · {[r.city, r.country].filter(Boolean).join(", ")}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {r.coverage_radius_km != null ? `${r.coverage_radius_km} km coverage` : ""}
            {r.contact_phone ? ` · ${r.contact_phone}` : ""}
          </p>
        </button>
      ),
    },
    {
      key: "status",
      label: "Plan",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge value={r.verification_status} tone={statusTone(r.verification_status)} />
          <StatusBadge value={`${r.plan}/${r.plan_status}`} />
          <StatusBadge value={`${r.seats_used ?? 0}/${r.max_seats} seats`} />
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedId(r.id)}
            className="h-9 px-2.5 text-xs border border-border"
          >
            Details
          </button>
          {r.verification_status === "pending" ? (
            <>
              <ConfirmAction
                label="Approve + pilot"
                busy={busyId === r.id}
                onConfirm={() => moderate(r.id, "approve_pilot")}
              />
              <ConfirmAction
                label="Reject"
                variant="danger"
                busy={busyId === r.id}
                onConfirm={() => moderate(r.id, "reject")}
              />
            </>
          ) : null}
          {r.verification_status === "approved" ? (
            <ConfirmAction
              label="Activate paid"
              variant="ghost"
              busy={busyId === r.id}
              onConfirm={() => moderate(r.id, "activate_plan")}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Responders" subtitle="Approve RapidBrief orgs and activate plans" />
      <AdminFilters className="mb-4" onSubmit={load}>
        <FilterInput placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </FilterSelect>
        <FilterButton>Search</FilterButton>
      </AdminFilters>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
        <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No organizations"} />

        <aside className="border border-border bg-surface p-4 sm:p-5 sticky top-4">
          {!selected ? (
            <p className="text-sm text-muted">Select an organization to review full application details.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted">Application detail</p>
                  <h2 className="text-lg font-semibold text-foreground mt-1 break-words">{selected.name}</h2>
                  <p className="text-xs text-muted mt-1">ID #{selected.id}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  <StatusBadge
                    value={selected.verification_status}
                    tone={statusTone(selected.verification_status)}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <DetailField label="Org type">{selected.org_type}</DetailField>
                <DetailField label="Location">
                  {[selected.city, selected.country].filter(Boolean).join(", ") || "—"}
                </DetailField>
                <DetailField label="Contact email">
                  {selected.contact_email ? (
                    <a className="text-primary hover:underline" href={`mailto:${selected.contact_email}`}>
                      {selected.contact_email}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailField>
                <DetailField label="Contact phone">
                  {selected.contact_phone || "—"}
                  {selected.whatsapp_opt_in ? (
                    <span className="block text-xs text-muted mt-0.5">WhatsApp opt-in</span>
                  ) : null}
                </DetailField>
                <DetailField label="Website">
                  {selected.website ? (
                    <a
                      className="text-primary hover:underline break-all"
                      href={selected.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {selected.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailField>
                <DetailField label="Coverage radius">
                  {selected.coverage_radius_km != null ? `${selected.coverage_radius_km} km` : "—"}
                </DetailField>
                <DetailField label="HQ coordinates">
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
                <DetailField label="Disaster types">
                  {Array.isArray(selected.disaster_types) && selected.disaster_types.length
                    ? selected.disaster_types.join(", ")
                    : "All / not specified"}
                </DetailField>
                <DetailField label="Plan">
                  {selected.plan} · {selected.plan_status}
                  <span className="block text-xs text-muted mt-0.5">
                    Seats {selected.seats_used ?? 0}/{selected.max_seats}
                  </span>
                </DetailField>
                <DetailField label="Plan window">
                  {[selected.plan_started_at, selected.plan_ends_at]
                    .filter(Boolean)
                    .map((d) => new Date(d).toLocaleString())
                    .join(" → ") || "Not started"}
                </DetailField>
                <DetailField label="Submitted">
                  {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
                </DetailField>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">Owner / applicant</p>
                {selected.owner ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <DetailField label="Name">{selected.owner.name || selected.owner.username || "—"}</DetailField>
                    <DetailField label="Email">{selected.owner.email || "—"}</DetailField>
                    <DetailField label="Username">{selected.owner.username || "—"}</DetailField>
                    <DetailField label="Phone">{selected.owner.phone || "—"}</DetailField>
                  </div>
                ) : (
                  <p className="text-sm text-muted">No owner linked.</p>
                )}
                {Array.isArray(selected.members) && selected.members.length > 1 ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Members</p>
                    <ul className="text-sm space-y-1">
                      {selected.members.map((m) => (
                        <li key={`${m.role}-${m.email}`} className="text-muted">
                          <span className="text-foreground">{m.email || m.username}</span> · {m.role}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {selected.verification_status === "pending" ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <ConfirmAction
                    label="Approve + pilot"
                    busy={busyId === selected.id}
                    onConfirm={() => moderate(selected.id, "approve_pilot")}
                  />
                  <ConfirmAction
                    label="Reject"
                    variant="danger"
                    busy={busyId === selected.id}
                    onConfirm={() => moderate(selected.id, "reject")}
                  />
                </div>
              ) : null}
              {selected.verification_status === "approved" ? (
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <ConfirmAction
                    label="Activate paid"
                    variant="ghost"
                    busy={busyId === selected.id}
                    onConfirm={() => moderate(selected.id, "activate_plan")}
                  />
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Responders;
