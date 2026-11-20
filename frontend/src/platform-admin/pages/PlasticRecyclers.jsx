import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminFilters,
  AdminTable,
  FilterButton,
  FilterSelect,
  PageHeader,
  StatusBadge,
  statusTone,
} from "../shared";

const PlasticRecyclers = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [status, setStatus] = useState("applied");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const data = await client.run(
        "get",
        `${endpoints.plasticRecyclerApplications}?${params}`,
        {},
        true
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not load applications");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, decision) => {
    setBusyId(id);
    try {
      await client.run(
        "post",
        endpoints.plasticRecyclerApprove(id),
        { decision },
        true
      );
      toast.success(decision === "reject" ? "Rejected" : "Recycler approved");
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
      label: "Yard",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.city}
            {r.address ? ` · ${r.address}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (r) => (
        <div className="text-sm">
          <p>{r.contact_phone || "—"}</p>
          <p className="text-xs text-muted">{r.contact_email || "—"}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge value={r.onboarding_status} tone={statusTone(r.onboarding_status)} />
      ),
    },
    {
      key: "message",
      label: "Application",
      render: (r) => (
        <p className="text-xs text-muted max-w-xs line-clamp-3">
          {r.application_message || "—"}
        </p>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        r.onboarding_status === "applied" ? (
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              disabled={busyId === r.id}
              className="h-8 px-2 border border-border text-xs disabled:opacity-60"
              onClick={() => decide(r.id, "reject")}
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busyId === r.id}
              className="h-8 px-2 bg-primary text-primary-foreground text-xs disabled:opacity-60"
              onClick={() => decide(r.id, "approve")}
            >
              Approve
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plastic recyclers"
        subtitle="Superadmin approval for yards joining the Climate Wavers marketplace. CBOs cannot approve."
      />
      <AdminFilters
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="applied">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </FilterSelect>
        <FilterButton>Refresh</FilterButton>
      </AdminFilters>
      <p className="text-xs text-muted">
        Recyclers apply at{" "}
        <Link to="/plastic/recycler-onboard" className="text-primary hover:underline">
          /plastic/recycler-onboard
        </Link>
        . After approval they buy lots on{" "}
        <Link to="/plastic/desk" className="text-primary hover:underline">
          /plastic/desk
        </Link>
        .
      </p>
      <AdminTable columns={columns} rows={rows} loading={loading} empty="No applications" />
    </div>
  );
};

export default PlasticRecyclers;
