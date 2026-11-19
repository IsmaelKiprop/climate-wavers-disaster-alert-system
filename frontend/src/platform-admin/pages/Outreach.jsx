import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import {
  AdminTable,
  ConfirmAction,
  PageHeader,
  StatusBadge,
} from "../shared";

const Outreach = () => {
  const [segments, setSegments] = useState([]);
  const [segmentId, setSegmentId] = useState("");
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [segmentMeta, setSegmentMeta] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadSegments = useCallback(async () => {
    try {
      const data = await client.run("get", endpoints.platformAdminOutreach, {}, true);
      const list = data?.segments || [];
      setSegments(list);
      if (!segmentId && list[0]?.id) setSegmentId(list[0].id);
    } catch {
      toast.error("Could not load engagement segments");
    }
  }, [segmentId]);

  const loadPreview = useCallback(async () => {
    if (!segmentId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        segment: segmentId,
        limit: String(Math.min(limit, 50)),
      });
      const data = await client.run(
        "get",
        `${endpoints.platformAdminOutreach}?${params}`,
        {},
        true
      );
      setRows(data?.results || []);
      setCount(data?.count || 0);
      setSegmentMeta(data?.segment || null);
      setSelected(new Set());
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not preview audience");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [segmentId, limit]);

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runSend = async ({ dryRun, selectedOnly }) => {
    if (!segmentId) return;
    setBusy(true);
    try {
      const payload = {
        segment: segmentId,
        dry_run: Boolean(dryRun),
        limit: Number(limit) || 50,
      };
      if (selectedOnly) {
        const ids = [...selected];
        if (!ids.length) {
          toast.error("Select at least one user");
          return;
        }
        payload.user_ids = ids;
      }
      const data = await client.run(
        "post",
        endpoints.platformAdminOutreach,
        payload,
        true
      );
      const label = dryRun ? "Preview" : "Sent";
      toast.success(
        `${label}: ${data?.sent ?? 0} ok · ${data?.failed ?? 0} failed · ${data?.attempted ?? 0} attempted`
      );
      if (!dryRun) await loadSegments();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Outreach failed");
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "pick",
        label: (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            aria-label="Select all visible"
          />
        ),
        render: (r) => (
          <input
            type="checkbox"
            checked={selected.has(r.id)}
            onChange={() => toggleOne(r.id)}
            aria-label={`Select ${r.email}`}
          />
        ),
      },
      {
        key: "user",
        label: "User",
        render: (r) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{r.email}</p>
            <p className="text-xs text-muted truncate">
              {r.name || "—"} · @{r.username || "—"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (r) => (
          <StatusBadge
            value={r.is_verified ? "verified" : "unverified"}
            tone={r.is_verified ? "ok" : "warn"}
          />
        ),
      },
      {
        key: "subject",
        label: "Unique subject (today)",
        render: (r) => (
          <div className="min-w-0 max-w-[28rem]">
            <p className="text-sm text-foreground line-clamp-2">{r.preview_subject}</p>
            <p className="text-[11px] text-muted mt-0.5">
              Variant {Number(r.variant) + 1} · {r.preview_headline}
            </p>
          </div>
        ),
      },
      {
        key: "joined",
        label: "Joined",
        render: (r) => (
          <span className="text-xs text-muted whitespace-nowrap">
            {r.date_joined ? new Date(r.date_joined).toLocaleDateString() : "—"}
          </span>
        ),
      },
    ],
    [allSelected, selected, rows]
  );

  return (
    <div>
      <PageHeader
        title="Engagement outreach"
        subtitle="Find users who stalled — unverified, incomplete profiles, no posts — and send creative, unique emails"
      />

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] gap-4 mb-4">
        <div className="border border-border bg-surface p-4 space-y-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">Audiences</p>
          <div className="space-y-2">
            {segments.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegmentId(s.id)}
                className={`w-full text-left border px-3 py-2.5 transition-colors ${
                  segmentId === s.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <span className="text-sm tabular-nums text-primary font-semibold">
                    {s.count ?? 0}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-snug">{s.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border bg-surface p-4 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted">Campaign</p>
            <h2 className="text-lg font-semibold text-foreground mt-1">
              {segmentMeta?.label || "Select an audience"}
            </h2>
            <p className="text-sm text-muted mt-1">
              {segmentMeta?.description ||
                "Each person gets a different creative subject/variant for today."}
            </p>
            <p className="text-sm text-foreground mt-3 tabular-nums">
              Matching users: <strong>{count.toLocaleString()}</strong>
            </p>
          </div>

          <label className="block text-sm space-y-1 max-w-[12rem]">
            <span className="text-xs uppercase tracking-wide text-muted">
              Batch size (max 200)
            </span>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
              className="w-full h-10 px-3 border border-border bg-background"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || loading}
              onClick={loadPreview}
              className="h-10 px-3 border border-border text-sm"
            >
              Refresh preview
            </button>
            <ConfirmAction
              label="Dry-run batch"
              busy={busy}
              onConfirm={() => runSend({ dryRun: true, selectedOnly: false })}
            />
            <ConfirmAction
              label={`Send batch (${Math.min(limit, count)} max)`}
              busy={busy}
              onConfirm={() => runSend({ dryRun: false, selectedOnly: false })}
            />
            <ConfirmAction
              label={`Send selected (${selected.size})`}
              busy={busy}
              onConfirm={() => runSend({ dryRun: false, selectedOnly: true })}
            />
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Emails are branded Climate Wavers messages with rotating creative copy.
            Staff accounts are excluded. Prefer dry-run, then send selected or a small batch.
          </p>
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={rows}
        empty={loading ? "Loading…" : "No users in this audience"}
      />
    </div>
  );
};

export default Outreach;
