import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { IoLeafOutline, IoLocationOutline } from "react-icons/io5";
import PlasticCollectorPanel from "../components/PlasticCollectorPanel";
import PlasticBagQrCard from "../components/PlasticBagQrCard";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { apiUrl } from "../config/env";
import PlasticOfflineSyncBanner from "../components/PlasticOfflineSyncBanner";

async function api(path, { method = "GET", body } = {}) {
  const token = getAuthToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

function statusLabel(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const PlasticCollectorDesk = () => {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [myBags, setMyBags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("projects");

  const loadProjects = useCallback(async () => {
    const data = await api(endpoints.plasticProjects);
    const list = Array.isArray(data) ? data : [];
    setProjects(list);
    return list;
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const data = await api(endpoints.plasticProject(id));
    setDetail(data);
  }, []);

  const loadMyBags = useCallback(async () => {
    try {
      const data = await api(endpoints.plasticMyRecoveries);
      setMyBags(Array.isArray(data) ? data : []);
    } catch {
      setMyBags([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await loadProjects();
        await loadMyBags();
        setSelectedId((prev) => prev || list[0]?.id || null);
      } catch (err) {
        toast.error(err.message || "Could not load Plastic Pulse projects");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProjects, loadMyBags]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    // Drop stale detail immediately so Collect does not show another project's hotspots.
    setDetail((prev) =>
      prev && Number(prev.id) === Number(selectedId) ? prev : null
    );
    loadDetail(selectedId).catch(() => setDetail(null));
  }, [selectedId, loadDetail]);

  const selected =
    detail && Number(detail.id) === Number(selectedId)
      ? detail
      : projects.find((p) => p.id === selectedId);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted">Plastic Pulse</p>
        <h1 className="text-2xl font-semibold text-foreground">Collect plastic</h1>
        <p className="text-sm text-muted max-w-2xl leading-relaxed">
          Signed-in collectors use this desk. Walk-in guests can collect without an account
          on any public project page (`/plastic/:id`) with name, phone, and the CBO claim PIN.
        </p>
        <PlasticOfflineSyncBanner
          noun="bag"
          onSynced={() => {
            loadMyBags();
            if (selectedId) loadDetail(selectedId);
          }}
        />
      </header>

      <div className="flex gap-1 border-b border-border">
        {[
          { id: "projects", label: "Active projects" },
          { id: "bags", label: `All my bags${myBags.length ? ` (${myBags.length})` : ""}` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              view === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : view === "bags" ? (
        <section className="space-y-3">
          {!myBags.length ? (
            <div className="border border-border bg-surface p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">No bags yet</p>
              <p className="text-sm text-muted">
                Open an active project, claim a hotspot, and submit your first bag.
              </p>
              <button
                type="button"
                onClick={() => setView("projects")}
                className="text-sm text-primary hover:underline"
              >
                Browse projects →
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {myBags.map((r) => (
                <li
                  key={r.id}
                  className="border border-border bg-surface p-4 space-y-2"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground tracking-wide">
                        {r.bag_id}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {r.project_name || `Project #${r.project}`} ·{" "}
                        {statusLabel(r.status)}
                      </p>
                    </div>
                    <Link
                      to={`/plastic/${r.project}`}
                      className="text-sm text-primary hover:underline shrink-0"
                    >
                      Project page
                    </Link>
                  </div>
                  <p className="text-sm text-muted">
                    {r.kg_verified != null ? r.kg_verified : r.kg_claimed} kg ·{" "}
                    {r.polymer_type}
                    {r.hotspot_title ? ` · ${r.hotspot_title}` : ""}
                  </p>
                  {r.reject_reason ? (
                    <p className="text-xs text-destructive">{r.reject_reason}</p>
                  ) : null}
                  {r.certificate_code ? (
                    <Link
                      to={r.verify_url || `/verify/plastic/${r.certificate_code}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Open certificate {r.certificate_code}
                    </Link>
                  ) : null}
                  <PlasticBagQrCard
                    bagId={r.bag_id}
                    kg={r.kg_verified ?? r.kg_claimed}
                    polymerType={r.polymer_type}
                    status={r.status}
                    compact
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          <aside className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted px-1">
              Choose a project
            </p>
            {!projects.length ? (
              <div className="border border-border bg-surface p-4 space-y-2">
                <IoLeafOutline className="text-muted" size={28} />
                <p className="text-sm text-foreground font-medium">
                  No active Plastic Pulse projects yet
                </p>
                <p className="text-sm text-muted">
                  When a CBO publishes a project, it will appear here for field
                  collection.
                </p>
                <Link
                  to="/plastic-pulse"
                  className="text-sm text-primary hover:underline"
                >
                  Learn about Plastic Pulse
                </Link>
              </div>
            ) : (
              <ul className="space-y-1">
                {projects.map((p) => {
                  const place = [p.city, p.region].filter(Boolean).join(", ");
                  const active = Number(selectedId) === Number(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={`w-full text-left border p-3 ${
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface hover:border-primary/40"
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {p.name}
                        </p>
                        {place ? (
                          <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-1">
                            <IoLocationOutline size={12} />
                            {place}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted mt-1">
                          {Number(p.recovered_kg || 0).toLocaleString()} /{" "}
                          {Number(p.goal_kg || 0).toLocaleString()} kg
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className="min-w-0 space-y-4">
            {selected ? (
              <>
                <div className="border border-border bg-surface p-4 space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    {selected.name}
                  </h2>
                  <p className="text-sm text-muted">
                    {selected.organization_display_name ||
                      selected.organization_name ||
                      "Climate Wavers partner"}
                    {selected.city ? ` · ${selected.city}` : ""}
                  </p>
                  {selected.short_description || selected.description ? (
                    <p className="text-sm text-muted leading-relaxed pt-1">
                      {selected.short_description || selected.description}
                    </p>
                  ) : null}
                </div>
                <PlasticCollectorPanel
                  project={selected}
                  showProjectLink
                  showOfflineBanner={false}
                  onProjectRefresh={() => {
                    loadDetail(selectedId);
                    loadMyBags();
                    loadProjects();
                  }}
                />
              </>
            ) : (
              <p className="text-sm text-muted">Select a project to start collecting.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlasticCollectorDesk;
