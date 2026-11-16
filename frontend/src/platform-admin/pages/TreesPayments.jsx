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
  FilterSelect,
  PageHeader,
  StatusBadge,
  statusTone,
} from "../shared";

const TreesPayments = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [tab, setTab] = useState("orgs");
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "orgs") {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("status", status);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminTreeOrgs}?${params}`,
          {},
          true
        );
        setRows(data?.results || []);
      } else if (tab === "projects") {
        const params = new URLSearchParams({ limit: "40" });
        if (status === "unverified") params.set("unverified", "1");
        const data = await client.run(
          "get",
          `${endpoints.platformAdminTreeProjects}?${params}`,
          {},
          true
        );
        setRows(data?.results || []);
      } else if (tab === "donations") {
        const data = await client.run(
          "get",
          `${endpoints.platformAdminTreeDonations}?limit=40`,
          {},
          true
        );
        setRows(data?.results || []);
      } else {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("payment_status", status);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminResponderPayments}?${params}`,
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
  }, [tab, status]);

  useEffect(() => {
    if (tab === "orgs" && !status) setStatus("pending");
    if (tab === "projects" && status !== "unverified" && status !== "") setStatus("unverified");
    if (tab === "payments" && status === "pending") {
      /* keep */
    }
    if (tab === "donations") setStatus("");
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const moderateOrg = async (id, action) => {
    setBusyId(id);
    try {
      await client.run("post", endpoints.platformAdminTreeOrgModerate(id), { action }, true);
      toast.success("Updated");
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const verifyProject = async (id) => {
    setBusyId(id);
    try {
      await client.run("post", endpoints.platformAdminTreeVerify(id), {}, true);
      toast.success("Project verified");
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const orgColumns = [
    {
      key: "name",
      label: "Organization",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.org_type} · {r.contact_email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge value={r.verification_status} tone={statusTone(r.verification_status)} />
          <StatusBadge value={`${r.plan}/${r.plan_status}`} />
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
              <ConfirmAction label="Approve pilot" busy={busyId === r.id} onConfirm={() => moderateOrg(r.id, "approve")} />
              <ConfirmAction label="Reject" variant="danger" busy={busyId === r.id} onConfirm={() => moderateOrg(r.id, "reject")} />
            </>
          ) : null}
          {r.verification_status === "approved" ? (
            <ConfirmAction label="Activate paid" variant="ghost" busy={busyId === r.id} onConfirm={() => moderateOrg(r.id, "activate_plan")} />
          ) : null}
        </div>
      ),
    },
  ];

  const projectColumns = [
    {
      key: "name",
      label: "Project",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">{[r.city, r.country].filter(Boolean).join(", ")}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Verified",
      render: (r) => (
        <StatusBadge value={r.is_verified ? "verified" : "unverified"} tone={r.is_verified ? "ok" : "warn"} />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) =>
        !r.is_verified ? (
          <ConfirmAction label="Verify" busy={busyId === r.id} onConfirm={() => verifyProject(r.id)} />
        ) : (
          <Link to="/app/admin/tree-projects" className="text-xs text-primary hover:underline">
            Open Tree Admin desk
          </Link>
        ),
    },
  ];

  const donationColumns = [
    {
      key: "ref",
      label: "Donation",
      render: (r) => (
        <div>
          <p className="font-medium">{r.project_name || `Project #${r.project_id}`}</p>
          <p className="text-xs text-muted font-mono">{r.payment_reference}</p>
        </div>
      ),
    },
    {
      key: "amt",
      label: "Amount",
      render: (r) => (
        <span>
          {r.amount} {r.currency} · {r.trees_purchased} trees
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge value={r.payment_status} tone={statusTone(r.payment_status)} />,
    },
  ];

  const paymentColumns = [
    {
      key: "org",
      label: "Responder payment",
      render: (r) => (
        <div>
          <p className="font-medium">{r.org_name || `Org #${r.org_id}`}</p>
          <p className="text-xs text-muted">
            {r.plan} · {r.months} mo · {r.payment_reference}
          </p>
        </div>
      ),
    },
    {
      key: "amt",
      label: "Amount",
      render: (r) => (
        <span>
          {r.amount} {r.currency}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge value={r.payment_status} tone={statusTone(r.payment_status)} />,
    },
  ];

  const columns =
    tab === "orgs"
      ? orgColumns
      : tab === "projects"
        ? projectColumns
        : tab === "donations"
          ? donationColumns
          : paymentColumns;

  return (
    <div>
      <PageHeader title="Trees & payments" subtitle="Tree Admin orgs, project verify, donations, responder billing" />
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ["orgs", "Tree Admin orgs"],
          ["projects", "Projects"],
          ["donations", "Tree donations"],
          ["payments", "Responder payments"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === "orgs") setStatus("pending");
              else if (id === "projects") setStatus("unverified");
              else if (id === "payments") setStatus("");
              else setStatus("");
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
        {tab === "orgs" ? (
          <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </FilterSelect>
        ) : null}
        {tab === "projects" ? (
          <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="unverified">Unverified</option>
            <option value="">All</option>
          </FilterSelect>
        ) : null}
        {tab === "payments" ? (
          <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </FilterSelect>
        ) : null}
        <FilterButton>Refresh</FilterButton>
      </AdminFilters>
      <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No rows"} />
    </div>
  );
};

export default TreesPayments;
