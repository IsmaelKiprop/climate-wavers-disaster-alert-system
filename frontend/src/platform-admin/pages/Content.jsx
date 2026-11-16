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
} from "../shared";

const Content = () => {
  const { refreshCounts } = useOutletContext() || {};
  const [tab, setTab] = useState("posts");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30", offset: "0" });
      if (q) params.set("q", q);
      if (tab === "posts") {
        if (filter === "donation") params.set("donation", "1");
        if (filter === "pending") params.set("pending_donation", "1");
        const data = await client.run(
          "get",
          `${endpoints.platformAdminPosts}?${params}`,
          {},
          true
        );
        setRows(data?.results || []);
      } else {
        const data = await client.run(
          "get",
          `${endpoints.platformAdminComments}?${params}`,
          {},
          true
        );
        setRows(data?.results || []);
      }
    } catch {
      toast.error("Could not load content");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, q, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const moderatePost = async (id, action) => {
    setBusyId(id);
    try {
      await client.run("post", endpoints.platformAdminPostModerate(id), { action }, true);
      toast.success("Updated");
      await load();
      refreshCounts?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const moderateComment = async (id) => {
    setBusyId(id);
    try {
      await client.run(
        "post",
        endpoints.platformAdminCommentModerate(id),
        { action: "delete" },
        true
      );
      toast.success("Comment removed");
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const postColumns = [
    {
      key: "content",
      label: "Post",
      render: (r) => (
        <div>
          <p className="font-medium">@{r.username}</p>
          <p className="text-muted text-xs mt-1 line-clamp-2">{r.content}</p>
        </div>
      ),
    },
    {
      key: "flags",
      label: "Flags",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.is_donation ? (
            <StatusBadge
              value={r.donation_approved ? "donation ok" : "donation pending"}
              tone={r.donation_approved ? "ok" : "warn"}
            />
          ) : null}
          <StatusBadge value={r.hidden ? "hidden" : "public"} tone={r.hidden ? "bad" : "ok"} />
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.is_donation && !r.donation_approved ? (
            <ConfirmAction
              label="Approve donation"
              busy={busyId === r.id}
              onConfirm={() => moderatePost(r.id, "approve_donation")}
            />
          ) : null}
          <ConfirmAction
            label={r.hidden ? "Restore" : "Hide"}
            variant="ghost"
            busy={busyId === r.id}
            onConfirm={() => moderatePost(r.id, r.hidden ? "restore" : "hide")}
          />
          <ConfirmAction
            label="Delete"
            variant="danger"
            busy={busyId === r.id}
            onConfirm={() => moderatePost(r.id, "delete")}
          />
        </div>
      ),
    },
  ];

  const commentColumns = [
    {
      key: "content",
      label: "Comment",
      render: (r) => (
        <div>
          <p className="font-medium">@{r.username}</p>
          <p className="text-xs text-muted">Post #{r.post_id}</p>
          <p className="text-muted text-xs mt-1 line-clamp-2">{r.content}</p>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (r) => (
        <ConfirmAction
          label="Remove"
          variant="danger"
          busy={busyId === r.id}
          onConfirm={() => moderateComment(r.id)}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Content" subtitle="Moderate posts and comments" />
      <div className="flex gap-2 mb-4">
        {["posts", "comments"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-9 px-3 text-sm border capitalize ${
              tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <AdminFilters className="mb-4" onSubmit={load}>
        <FilterInput placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        {tab === "posts" ? (
          <FilterSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All posts</option>
            <option value="donation">Donations</option>
            <option value="pending">Pending donation approval</option>
          </FilterSelect>
        ) : null}
        <FilterButton>Search</FilterButton>
      </AdminFilters>
      <AdminTable
        columns={tab === "posts" ? postColumns : commentColumns}
        rows={rows}
        empty={loading ? "Loading…" : "No content"}
      />
    </div>
  );
};

export default Content;
