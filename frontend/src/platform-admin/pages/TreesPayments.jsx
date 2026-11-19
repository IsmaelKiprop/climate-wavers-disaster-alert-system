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
  const [certBusy, setCertBusy] = useState(null);
  const [certPreview, setCertPreview] = useState(null);
  const [orgPriceDraft, setOrgPriceDraft] = useState("");
  const [orgFeeDraft, setOrgFeeDraft] = useState("");
  const [pricingBusy, setPricingBusy] = useState(false);
  const [payoutDraft, setPayoutDraft] = useState({
    payouts_enabled: false,
    payout_channel: "mobile_money",
    payout_account_name: "",
    payout_account_number: "",
    payout_bank_code: "MPESA",
  });
  const [payoutBusy, setPayoutBusy] = useState(false);

  const fetchCertificatePng = async (donationId) => {
    const data = await client.run(
      "get",
      `${endpoints.platformAdminTreeDonationCertificate(donationId)}?format=json`,
      {},
      true
    );
    if (!data?.png_base64) {
      throw new Error("Certificate image missing");
    }
    return {
      certificateId: data.certificate_id || "",
      filename: data.filename || `ClimateWavers_Certificate_${donationId}.png`,
      dataUrl: `data:image/png;base64,${data.png_base64}`,
      donation: data.donation || null,
    };
  };

  const downloadCertificate = async (donationId) => {
    setCertBusy(`dl-${donationId}`);
    try {
      const cert = certPreview?.donationId === donationId
        ? certPreview
        : await fetchCertificatePng(donationId);
      const link = document.createElement("a");
      link.href = cert.dataUrl;
      link.download = cert.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Certificate downloaded");
      if (cert.donation) {
        setRows((prev) =>
          prev.map((r) => (r.id === donationId ? { ...r, ...cert.donation } : r))
        );
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Download failed");
    } finally {
      setCertBusy(null);
    }
  };

  const previewCertificate = async (donationId) => {
    setCertBusy(`pv-${donationId}`);
    try {
      const cert = await fetchCertificatePng(donationId);
      setCertPreview({ donationId, ...cert });
      if (cert.donation) {
        setRows((prev) =>
          prev.map((r) => (r.id === donationId ? { ...r, ...cert.donation } : r))
        );
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || "Preview failed");
    } finally {
      setCertBusy(null);
    }
  };

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

  useEffect(() => {
    if (tab !== "orgs" || !selected) {
      setOrgPriceDraft("");
      setOrgFeeDraft("");
      setPayoutDraft({
        payouts_enabled: false,
        payout_channel: "mobile_money",
        payout_account_name: "",
        payout_account_number: "",
        payout_bank_code: "MPESA",
      });
      return;
    }
    setOrgPriceDraft(
      selected.default_tree_price != null ? String(selected.default_tree_price) : ""
    );
    setOrgFeeDraft(
      selected.platform_fee_percent != null
        ? String(selected.platform_fee_percent)
        : selected.effective_platform_fee_rate != null
          ? String(Number(selected.effective_platform_fee_rate) * 100)
          : "18"
    );
    setPayoutDraft({
      payouts_enabled: Boolean(selected.payouts_enabled),
      payout_channel: selected.payout_channel || "mobile_money",
      payout_account_name: selected.payout_account_name || "",
      payout_account_number: selected.payout_account_number || "",
      payout_bank_code: selected.payout_bank_code || "MPESA",
    });
  }, [
    tab,
    selectedId,
    selected?.default_tree_price,
    selected?.platform_fee_percent,
    selected?.effective_platform_fee_rate,
    selected?.payouts_enabled,
    selected?.payout_channel,
    selected?.payout_account_name,
    selected?.payout_account_number,
    selected?.payout_bank_code,
  ]);

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

  const saveOrgPricing = async (id) => {
    setPricingBusy(true);
    try {
      const payload = {
        action: "update_pricing",
        default_tree_price: orgPriceDraft === "" ? null : orgPriceDraft,
        platform_fee_rate: orgFeeDraft === "" ? null : orgFeeDraft,
      };
      const data = await client.run(
        "post",
        endpoints.platformAdminTreeOrgModerate(id),
        payload,
        true
      );
      toast.success("Pricing updated for this Tree Admin");
      if (data?.org) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.org } : r)));
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save pricing");
    } finally {
      setPricingBusy(false);
    }
  };

  const saveOrgPayout = async (id) => {
    setPayoutBusy(true);
    try {
      const data = await client.run(
        "post",
        endpoints.platformAdminTreeOrgModerate(id),
        { action: "update_payout", ...payoutDraft },
        true
      );
      toast.success("Payout details saved");
      if (data?.org) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.org } : r)));
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save payout details");
    } finally {
      setPayoutBusy(false);
    }
  };

  const repairFunds = async () => {
    setBusyId("repair-funds");
    try {
      const data = await client.run(
        "post",
        endpoints.platformAdminTreeDonations,
        { action: "repair_funds" },
        true
      );
      toast.success(
        `Repaired ${data?.donations_repaired ?? 0} donations · recomputed ${data?.projects_recomputed ?? 0} projects`
      );
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Fund repair failed");
    } finally {
      setBusyId(null);
    }
  };

  const retryDonationPayout = async (id) => {
    setBusyId(id);
    try {
      const data = await client.run(
        "post",
        endpoints.platformAdminTreeDonationPayout(id),
        { force: true },
        true
      );
      const status = data?.payout?.status || data?.donation?.payout_status;
      if (data?.payout?.ok || status === "success") {
        toast.success("Admin share payout sent");
      } else {
        toast.error(data?.payout?.detail || data?.donation?.payout_error || `Payout ${status || "failed"}`);
      }
      if (data?.donation) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...data.donation } : r)));
      } else {
        await load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Payout retry failed");
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
          <DetailField label="Default tree price">
            {selected.default_tree_price != null
              ? `$${Number(selected.default_tree_price).toFixed(2)} USD`
              : "Not set (project sets its own)"}
          </DetailField>
          <DetailField label="Platform fee">
            {selected.platform_fee_percent != null
              ? `${selected.platform_fee_percent}% (admin keeps ${selected.admin_share_percent}%)`
              : "18% default"}
          </DetailField>
        </div>
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Pricing for this Tree Admin
          </p>
          <p className="text-xs text-muted">
            Each org can have its own default seedling price and platform fee. Projects can still override price per species.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="text-muted text-xs uppercase tracking-wide">Default USD / tree</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={orgPriceDraft}
                onChange={(e) => setOrgPriceDraft(e.target.value)}
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder="e.g. 2.00"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted text-xs uppercase tracking-wide">Platform fee %</span>
              <input
                type="number"
                min="0"
                max="99"
                step="0.1"
                value={orgFeeDraft}
                onChange={(e) => setOrgFeeDraft(e.target.value)}
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder="e.g. 18"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={pricingBusy}
            onClick={() => saveOrgPricing(selected.id)}
            className="h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {pricingBusy ? "Saving…" : "Save pricing"}
          </button>
        </div>
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Auto payout (admin share → M-Pesa / bank)
          </p>
          <p className="text-xs text-muted">
            After each completed tree sale, Paystack transfers the admin share in KES.
            Requires <code className="text-[11px]">PAYSTACK_TRANSFER_ENABLED=true</code> on the API
            and settled Paystack balance.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payoutDraft.payouts_enabled}
              onChange={(e) =>
                setPayoutDraft((d) => ({ ...d, payouts_enabled: e.target.checked }))
              }
            />
            Enable auto payouts for this org
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="text-muted text-xs uppercase tracking-wide">Channel</span>
              <select
                value={payoutDraft.payout_channel}
                onChange={(e) =>
                  setPayoutDraft((d) => ({
                    ...d,
                    payout_channel: e.target.value,
                    payout_bank_code:
                      e.target.value === "mobile_money" ? "MPESA" : d.payout_bank_code,
                  }))
                }
                className="w-full h-10 px-3 border border-border bg-background"
              >
                <option value="mobile_money">M-Pesa</option>
                <option value="bank">Bank (KEPSS)</option>
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted text-xs uppercase tracking-wide">
                {payoutDraft.payout_channel === "bank" ? "Bank code" : "Bank code"}
              </span>
              <input
                value={payoutDraft.payout_bank_code}
                onChange={(e) =>
                  setPayoutDraft((d) => ({ ...d, payout_bank_code: e.target.value }))
                }
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder={payoutDraft.payout_channel === "bank" ? "e.g. 01" : "MPESA"}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted text-xs uppercase tracking-wide">Account name</span>
              <input
                value={payoutDraft.payout_account_name}
                onChange={(e) =>
                  setPayoutDraft((d) => ({ ...d, payout_account_name: e.target.value }))
                }
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder="As registered on M-Pesa / bank"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted text-xs uppercase tracking-wide">
                {payoutDraft.payout_channel === "bank" ? "Account number" : "M-Pesa phone"}
              </span>
              <input
                value={payoutDraft.payout_account_number}
                onChange={(e) =>
                  setPayoutDraft((d) => ({ ...d, payout_account_number: e.target.value }))
                }
                className="w-full h-10 px-3 border border-border bg-background"
                placeholder={
                  payoutDraft.payout_channel === "bank" ? "0123456789" : "07XXXXXXXX"
                }
              />
            </label>
          </div>
          {selected.paystack_recipient_code ? (
            <p className="text-xs text-muted font-mono">
              Recipient: {selected.paystack_recipient_code}
            </p>
          ) : null}
          <button
            type="button"
            disabled={payoutBusy}
            onClick={() => saveOrgPayout(selected.id)}
            className="h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
          >
            {payoutBusy ? "Saving…" : "Save payout details"}
          </button>
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
          <DetailField label="Tree price">
            {selected.tree_price != null ? `$${Number(selected.tree_price).toFixed(2)} USD` : "—"}
          </DetailField>
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
    const certReady = selected.payment_status === "completed";
    detail = (
      <DetailPanel
        title={selected.project_name || `Project #${selected.project_id}`}
        subtitle={`Donation #${selected.id}`}
        actions={
          <>
            <button
              type="button"
              disabled={!certReady || certBusy === `pv-${selected.id}`}
              onClick={() => previewCertificate(selected.id)}
              className="h-9 px-3 text-sm border border-border disabled:opacity-50"
            >
              {certBusy === `pv-${selected.id}` ? "Loading…" : "Preview certificate"}
            </button>
            <button
              type="button"
              disabled={!certReady || certBusy === `dl-${selected.id}`}
              onClick={() => downloadCertificate(selected.id)}
              className="h-9 px-3 text-sm border border-border disabled:opacity-50"
            >
              {certBusy === `dl-${selected.id}` ? "Downloading…" : "Download PNG"}
            </button>
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
          </>
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
          <DetailField label="Admin share payout">
            <StatusBadge
              value={selected.payout_status || "none"}
              tone={
                selected.payout_status === "success"
                  ? "ok"
                  : selected.payout_status === "failed"
                    ? "bad"
                    : "warn"
              }
            />
          </DetailField>
          <DetailField label="Payout amount">
            {selected.payout_amount_kes != null
              ? `${selected.payout_amount_kes} KES`
              : "—"}
          </DetailField>
          <DetailField label="Payout transfer">
            <span className="font-mono text-xs">
              {selected.payout_transfer_code || selected.payout_reference || "—"}
            </span>
          </DetailField>
          <DetailField label="Payout error">{selected.payout_error || "—"}</DetailField>
        </div>
        {certReady ? (
          <div className="border-t border-border pt-3">
            <ConfirmAction
              label="Retry admin payout"
              busy={busyId === selected.id}
              onConfirm={() => retryDonationPayout(selected.id)}
            />
          </div>
        ) : (
          <p className="text-xs text-muted">Preview / download unlock after payment status is completed.</p>
        )}
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
        {tab === "donations" ? (
          <ConfirmAction
            label="Repair funds (KES→USD)"
            busy={busyId === "repair-funds"}
            onConfirm={repairFunds}
          />
        ) : null}
        <FilterButton>Refresh</FilterButton>
      </AdminFilters>
      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4 items-start">
        <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No rows"} />
        {detail}
      </div>

      {certPreview ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Certificate preview"
          onClick={() => setCertPreview(null)}
        >
          <div
            className="bg-surface border border-border w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted">Certificate preview</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {certPreview.certificateId || certPreview.filename}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={certBusy === `dl-${certPreview.donationId}`}
                  onClick={() => downloadCertificate(certPreview.donationId)}
                  className="h-9 px-3 text-sm bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {certBusy === `dl-${certPreview.donationId}` ? "Downloading…" : "Download PNG"}
                </button>
                <button
                  type="button"
                  onClick={() => setCertPreview(null)}
                  className="h-9 px-3 text-sm border border-border"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-auto p-3 sm:p-4 bg-background">
              <img
                src={certPreview.dataUrl}
                alt={`Certificate ${certPreview.certificateId || ""}`}
                className="w-full h-auto border border-border bg-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TreesPayments;
