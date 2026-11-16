import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminFilters,
  AdminTable,
  FilterButton,
  FilterInput,
  FilterSelect,
  PageHeader,
  StatusBadge,
} from "../shared";

const Newsletter = () => {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("1");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("q", q);
      if (active === "1") params.set("active", "1");
      const data = await client.run(
        "get",
        `${endpoints.platformAdminNewsletter}?${params}`,
        {},
        true
      );
      setRows(data?.results || []);
    } catch {
      toast.error("Could not load subscribers");
    } finally {
      setLoading(false);
    }
  }, [q, active]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: "email",
      label: "Email",
      render: (r) => <span className="font-medium">{r.email}</span>,
    },
    {
      key: "source",
      label: "Source",
      render: (r) => <span className="text-muted">{r.source || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <StatusBadge value={r.is_active ? "active" : "inactive"} tone={r.is_active ? "ok" : "neutral"} />
      ),
    },
    {
      key: "created",
      label: "Joined",
      render: (r) => (
        <span className="text-xs text-muted">
          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Newsletter" subtitle="Subscriber list" />
      <AdminFilters className="mb-4" onSubmit={load}>
        <FilterInput placeholder="Search email" value={q} onChange={(e) => setQ(e.target.value)} />
        <FilterSelect value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="1">Active only</option>
          <option value="">All</option>
        </FilterSelect>
        <FilterButton>Search</FilterButton>
      </AdminFilters>
      <AdminTable columns={columns} rows={rows} empty={loading ? "Loading…" : "No subscribers"} />
    </div>
  );
};

export default Newsletter;
