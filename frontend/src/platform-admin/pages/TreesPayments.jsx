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
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let next = [];
      if (tab === "orgs") {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("status", status);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminTreeOrgs}?${params}`,
          {},
          true
        );
        next = data?.results || [];
      } else if (tab === "projects") {
        const params = new URLSearchParams({ limit: "40" });
        if (status === "unverified") params.set("unverified", "1");
        const data = await client.run(
          "get",
          `${endpoints.platformAdminTreeProjects}?${params}`,
          {},
          true
        );
        next = data?.results || [];
      } else if (tab === "donations") {
        const data = await client.run(
          "get",
          `${endpoints.platformAdminTreeDonations}?limit=40`,
          {},
          true
        );
        next = data?.results || [];
      } else {
        const params = new URLSearchParams({ limit: "40" });
        if (status) params.set("payment_status", status);
        const data = await client.run(
          "get",
          `${endpoints.platformAdminResponderPayments}?${params}`,
          {},
          true
        );
        next = data?.results || [];
      }
      setRows(next);
      setSelectedId((prev) => (prev && next.some((r) => r.id === prev) ? prev : next[0]?.id ?? null));
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
    if (tab === "donations") setStatus("");
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) || null;

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
        <button type="button" onClick={() => setSelectedId(r.id)} className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">
            {r.org_type} · {r.contact_email || "—"}
          </p>
        </button>
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
          <button type="button" onClick={() => setSelectedId(r.id)} className="h-9 px-2.5 text-xs border border-border">
            Details
          </button>
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
        <button type="button" onClick={() => setSelectedId(r.id)} className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted">{[r.city, r.country].filter(Boolean).join(", ")}</p>
        </button>
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
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setSelectedId(r.id)} className="h-9 px-2.5 text-xs border border-border">
            Details
          </button>
          {!r.is_verified ? (
            <ConfirmAction label="Verify" busy={busyId === r.id} onConfirm={() => verifyProject(r.id)} />
          ) : (
            <Link to="/app/admin/tree-projects" className="text-xs text-primary hover:underline self-center">
              Open Tree Admin desk
            </Link>
          )}
        </div>
      ),
    },
  ];

  const donationColumns = [
    {
      key: "ref",
      label: "Donation",
      render: (r) => (
        <button type="button" onClick={() => setSelectedId(r.id)} className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}>
          <p className="font-medium">{r.project_name || `Project #${r.project_id}`}</p>
          <p className="text-xs text-muted font-mono">{r.payment_reference}</p>
        </button>
      ),
    },
    {
      key: "payer",
      label: "Payer",
      render: (r) => (
        <div>
          <p className="text-sm">{r.donor_name || "—"}</p>
          <p className="text-xs text-muted">{r.donor_email || ""}</p>
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
      key: "cert",
      label: "Certificate",
      render: (r) => (
        <span className="text-xs">
          {r.certificate_emailed_at ? "Emailed" : r.certificate_id ? "Issued" : "Pending"}
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
        <button type="button" onClick={() => setSelectedId(r.id)} className={`text-left w-full ${selectedId === r.id ? "text-primary" : ""}`}>
          <p className="font-medium">{r.org_name || `Org #${r.org_id}`}</p>
          <p className="text-xs text-muted">
            {r.plan} · {r.months} mo · {r.payment_reference}
          </p>
        </button>
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

  let detail = <DetailPanel empty="Select a row to review full details." />;
  if (selected && tab === "orgs") {
    detail = (
      <DetailPanel
        title={selected.name}
        subtitle={`ID #${selected.id}`}
        badge={<StatusBadge value={selected.verification_status} tone={statusTone(selected.verification_status)} />}
        actions={
          <>
            {selected.verification_status === "pending" ? (
              <>
                <ConfirmAction label="Approve pilot" busy={busyId === selected.id} onConfirm={() => moderateOrg(selected.id, "approve")} />
                <ConfirmAction label="Reject" variant="danger" busy={busyId === selected.id} onConfirm={() => moderateOrg(selected.id, "reject")} />
              </>
            ) : null}
            {selected.verification_status === "approved" ? (
              <ConfirmAction label="Activate paid" variant="ghost" busy={busyId === selected.id} onConfirm={() => moderateOrg(selected.id, "activate_plan")} />
            ) : null}
          </>
        }
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <DetailField label="Org type">{selected.org_type}</DetailField>
          <DetailField label="Location">{[selected.city, selected.country].filter(Boolean).join(", ") || "—"}</DetailField>
          <DetailField label="Contact email">
            {selected.contact_email ? (
              <a className="text-primary hover:underline" href={`mailto:${selected.contact_email}`}>{selected.contact_email}</a>
            ) : "—"}
          </DetailField>
          <DetailField label="Contact phone">{selected.contact_phone || "—"}</DetailField>
          <DetailField label="Website">
            {selected.website ? (
              <a className="text-primary hover:underline break-all" href={selected.website} target="_blank" rel="noreferrer">{selected.website}</a>
            ) : "—"}
          </DetailField>
          <DetailField label="Plan">{`${selected.plan} · ${selected.plan_status}`}</DetailField>
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
        {selected.planting_sites_note ? (
          <div className="border-t border-border pt-4">
            <DetailField label="Planting sites">{selected.planting_sites_note}</DetailField>
          </div>
        ) : null}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Owner / applicant</p>
          {selected.owner ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <DetailField label="Name">{selected.owner.name || selected.owner.username || "—"}</DetailField>
              <DetailField label="Email">{selected.owner.email || "—"}</DetailField>
              <DetailField label="Phone">{selected.owner.phone || "—"}</DetailField>
              <DetailField label="Username">{selected.owner.username || "—"}</DetailField>
            </div>
          ) : (
            <p className="text-sm text-muted">No owner linked.</p>
          )}
        </div>
      </DetailPanel>
    );
  } else if (selected && tab === "projects") {
    detail = (
      <DetailPanel
        title={selected.name}
        subtitle={`ID #${selected.id}`}
        badge={<StatusBadge value={selected.is_verified ? "verified" : "unverified"} tone={selected.is_verified ? "ok" : "warn"} />}
        actions={
          !selected.is_verified ? (
            <ConfirmAction label="Verify" busy={busyId === selected.id} onConfirm={() => verifyProject(selected.id)} />
          ) : (
            <Link to="/app/admin/tree-projects" className="h-9 px-2.5 text-xs border border-border inline-flex items-center">
              Open Tree Admin desk
            </Link>
          )
        }
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <DetailField label="Organization">{selected.organization_name || "—"}</DetailField>
          <DetailField label="Type / status">{[selected.project_type, selected.status].filter(Boolean).join(" · ") || "—"}</DetailField>
          <DetailField label="Location">{[selected.city, selected.country].filter(Boolean).join(", ") || "—"}</DetailField>
          <DetailField label="Trees">{`${selected.trees_planted ?? 0} / ${selected.target_trees ?? "—"}`}</DetailField>
          <DetailField label="Contact">{[selected.contact_person, selected.contact_email, selected.contact_phone].filter(Boolean).join(" · ") || "—"}</DetailField>
          <DetailField label="Website">
            {selected.organization_website ? (
              <a className="text-primary hover:underline break-all" href={selected.organization_website} target="_blank" rel="noreferrer">{selected.organization_website}</a>
            ) : "—"}
          </DetailField>
          <DetailField label="Coordinates">
            {selected.latitude != null && selected.longitude != null
              ? `${selected.latitude}, ${selected.longitude}`
              : "—"}
          </DetailField>
          <DetailField label="Timeline">
            {[selected.start_date, selected.expected_completion].filter(Boolean).join(" → ") || "—"}
          </DetailField>
        </div>
        {selected.description ? (
          <div className="border-t border-border pt-4">
            <DetailField label="Summary">{selected.description}</DetailField>
          </div>
        ) : null}
      </DetailPanel>
    );
  } else if (selected && tab === "donations") {
    detail = (
      <DetailPanel
        title={selected.project_name || `Project #${selected.project_id}`}
        subtitle={`Donation #${selected.id}`}
        actions={
          <ConfirmAction
            label={selected.certificate_emailed_at ? "Re-send certificate" : "Issue & email certificate"}
            busy={busyId === selected.id}
            onConfirm={async () => {
              setBusyId(selected.id);
              try {
                await client.run(
                  "post",
                  endpoints.platformAdminTreeDonationCertificate(selected.id),
                  { resend: true },
                  true
                );
                toast.success("Certificate emailed");
                await load();
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Certificate send failed");
              } finally {
                setBusyId(null);
              }
            }}
          />
        }
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <DetailField label="Amount">{`${selected.amount} ${selected.currency}`}</DetailField>
          <DetailField label="Trees">{selected.trees_purchased}</DetailField>
          <DetailField label="Species">
            {selected.selected_species && Object.keys(selected.selected_species).length
              ? Object.entries(selected.selected_species)
                  .map(([name, qty]) => `${name} × ${qty}`)
                  .join(", ")
              : "—"}
          </DetailField>
          <DetailField label="Status">{selected.payment_status}</DetailField>
          <DetailField label="Reference"><span className="font-mono text-xs">{selected.payment_reference || "—"}</span></DetailField>
          <DetailField label="Payer">{selected.donor_name || selected.donor_email || "—"}</DetailField>
          <DetailField label="Email">{selected.donor_email || "—"}</DetailField>
          <DetailField label="Gifted to">{selected.gifted_to || "—"}</DetailField>
          <DetailField label="Certificate ID"><span className="font-mono text-xs">{selected.certificate_id || "—"}</span></DetailField>
          <DetailField label="Certificate emailed">
            {selected.certificate_emailed_at
              ? new Date(selected.certificate_emailed_at).toLocaleString()
              : "Not yet"}
          </DetailField>
          <DetailField label="Created">{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</DetailField>
        </div>
      </DetailPanel>
    );
  } else if (selected && tab === "payments") {
    detail = (
      <DetailPanel title={selected.org_name || `Org #${selected.org_id}`} subtitle={`Payment #${selected.id}`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <DetailField label="Plan">{selected.plan}</DetailField>
          <DetailField label="Months">{selected.months}</DetailField>
          <DetailField label="Amount">{`${selected.amount} ${selected.currency}`}</DetailField>
          <DetailField label="Status">{selected.payment_status}</DetailField>
          <DetailField label="Reference"><span className="font-mono text-xs">{selected.payment_reference || "—"}</span></DetailField>
          <DetailField label="Created">{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</DetailField>
        </div>
      </DetailPanel>
    );
  }

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
              setSelectedId(null);
              if (id === "orgs") setStatus("pending");
              else if (id === "projects") setStatus("unverified");
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
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
        <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No rows"} />
        {detail}
      </div>
    </div>
  );
};

export default TreesPayments;
