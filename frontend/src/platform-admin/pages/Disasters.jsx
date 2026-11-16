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

const Disasters = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    disaster_type: "flood",
    severity: "moderate",
    country: "Kenya",
    region: "Nairobi",
    city: "Nairobi",
    description: "",
  });
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      const data = await client.run(
        "get",
        `${endpoints.platformAdminDisasters}?${params}`,
        {},
        true
      );
      setRows(data?.results || []);
    } catch {
      toast.error("Could not load disasters");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await client.run("post", endpoints.platformAdminDisasters, form, true);
      toast.success("Disaster created");
      setShowForm(false);
      setForm((f) => ({ ...f, title: "", description: "" }));
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Create failed");
    }
  };

  const patch = async (id, body) => {
    setBusyId(id);
    try {
      await client.run("patch", endpoints.platformAdminDisaster(id), body, true);
      toast.success("Updated");
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const createAlert = async (id) => {
    setBusyId(id);
    try {
      await client.run("post", endpoints.platformAdminDisasterAlert(id), {}, true);
      toast.success("Alert stub created");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Alert failed");
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: "title",
      label: "Disaster",
      render: (r) => (
        <div>
          <p className="font-medium">{r.title}</p>
          <p className="text-xs text-muted">
            {r.disaster_type} · {[r.city, r.region, r.country].filter(Boolean).join(", ")}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge value={r.status} tone={statusTone(r.status)} />
          <StatusBadge value={r.severity} tone={statusTone(r.severity)} />
          <StatusBadge value={r.is_verified ? "verified" : "unverified"} tone={r.is_verified ? "ok" : "warn"} />
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          <ConfirmAction
            label="Resolve"
            busy={busyId === r.id}
            onConfirm={() => patch(r.id, { status: "resolved" })}
          />
          {!r.is_verified ? (
            <ConfirmAction
              label="Verify"
              variant="ghost"
              busy={busyId === r.id}
              onConfirm={() => patch(r.id, { is_verified: true })}
            />
          ) : null}
          <ConfirmAction
            label="Create alert"
            variant="ghost"
            busy={busyId === r.id}
            onConfirm={() => createAlert(r.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Disasters"
        subtitle="Create, verify, resolve, and stub alerts"
        actions={
          <button
            type="button"
            className="h-10 px-3 bg-primary text-primary-foreground text-sm"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Close form" : "New disaster"}
          </button>
        }
      />
      {showForm ? (
        <form onSubmit={create} className="border border-border bg-surface p-4 mb-4 grid sm:grid-cols-2 gap-3">
          <FilterInput
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <FilterSelect
            value={form.disaster_type}
            onChange={(e) => setForm((f) => ({ ...f, disaster_type: e.target.value }))}
          >
            {["flood", "earthquake", "wildfire", "drought", "storm", "other"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={form.severity}
            onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
          >
            {["low", "moderate", "high", "severe", "extreme"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </FilterSelect>
          <FilterInput
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <textarea
            className="sm:col-span-2 border border-border bg-background p-3 text-sm min-h-[80px]"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <FilterButton>Create</FilterButton>
        </form>
      ) : null}
      <AdminFilters className="mb-4" onSubmit={load}>
        <FilterInput placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["monitoring", "alert", "warning", "ongoing", "contained", "resolved"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>
        <FilterButton>Search</FilterButton>
      </AdminFilters>
      <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No disasters"} />
    </div>
  );
};

export default Disasters;
