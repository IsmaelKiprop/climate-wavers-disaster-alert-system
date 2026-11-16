import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
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

const Responders = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

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
      setRows(data?.results || []);
    } catch {
      toast.error("Could not load responders");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    load();
  }, [load]);

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
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.org_type} · {r.contact_email || "—"} · {[r.city, r.country].filter(Boolean).join(", ")}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Plan",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge value={r.verification_status} tone={statusTone(r.verification_status)} />
          <StatusBadge value={`${r.plan}/${r.plan_status}`} />
          <StatusBadge value={`${r.max_seats} seats`} />
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
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
      <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No organizations"} />
    </div>
  );
};

export default Responders;
