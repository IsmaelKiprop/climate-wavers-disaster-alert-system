import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose, IoLeafOutline } from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { unwrapList } from "../utils/apiData";
import {
  normalizeTreeSpecies,
  speciesRemaining,
} from "../utils/treeSpecies";
import TreePayment from "./TreePayment";

/**
 * Buy / gift trees for a Climate calendar day's activities —
 * shows available projects + species for that day (not the full plant-tree catalog).
 */
const DayActivityTreeGiftModal = ({ open, event, onClose, onGifted }) => {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [checkout, setCheckout] = useState(null);

  const isObservance = Boolean(event?.is_observance);
  const eventId = !isObservance && event?.id != null ? event.id : null;

  useEffect(() => {
    if (!open || !event) return undefined;
    let alive = true;
    setLoading(true);
    setSelectedProject(null);
    setCheckout(null);
    setPayload(null);

    const load = async () => {
      try {
        if (eventId) {
          const data = await client.run(
            "get",
            `${endpoints.climateEvents}${eventId}/gift-options/`,
            {},
            true
          );
          if (!alive) return;
          setPayload(data);
          const projects = Array.isArray(data?.projects) ? data.projects : [];
          if (data?.linked_project) {
            setSelectedProject(data.linked_project);
          } else if (projects.length === 1) {
            setSelectedProject(projects[0]);
          }
        } else {
          const data = await client.run(
            "get",
            endpoints.tree_projects_african,
            {},
            false
          );
          if (!alive) return;
          const projects = unwrapList(data).slice(0, 24);
          setPayload({
            title: event.title,
            trees_gifted: 0,
            gift_count: 0,
            projects,
            linked_project: null,
          });
          if (projects.length === 1) setSelectedProject(projects[0]);
        }
      } catch (err) {
        if (alive) {
          toast.error(
            err?.response?.data?.detail || "Could not load trees for this day"
          );
          setPayload({ projects: [], title: event.title });
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [open, event, eventId]);

  const projects = useMemo(
    () => (Array.isArray(payload?.projects) ? payload.projects : []),
    [payload]
  );

  const species = useMemo(
    () => normalizeTreeSpecies(selectedProject?.tree_species),
    [selectedProject]
  );

  const availableSpecies = useMemo(
    () =>
      species.filter((s) => {
        const rem = speciesRemaining(s);
        return rem == null || rem > 0;
      }),
    [species]
  );

  const startCheckout = () => {
    if (!selectedProject) {
      toast.error("Pick a tree option for this day");
      return;
    }
    if (availableSpecies.length === 0 && species.length > 0) {
      toast.error("No species left in inventory for this project");
      return;
    }
    setCheckout({
      ...selectedProject,
      name: selectedProject.name,
      description: selectedProject.description || selectedProject.short_description,
      price: selectedProject.tree_price,
      co2Absorption: selectedProject.co2_absorption_per_tree,
      tree_species: selectedProject.tree_species || [],
      plantingLocation: `${selectedProject.city || ""}, ${selectedProject.country || ""}`
        .replace(/^,\s*|,\s*$/g, "")
        .trim(),
      benefits: ["Climate day activity", "Verified planting"],
    });
  };

  if (!open || !event || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-lg border border-border max-h-[92dvh] overflow-y-auto bg-surface"
        style={{
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-gift-title"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 px-4 py-3 border-b border-border bg-surface">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted inline-flex items-center gap-1">
              <IoLeafOutline size={12} />
              Trees for this day
            </p>
            <h3
              id="day-gift-title"
              className="text-base font-semibold text-foreground leading-snug mt-0.5"
            >
              {payload?.title || event.title}
            </h3>
            <p className="text-xs text-muted mt-1">
              Choose available trees for today’s activities
              {payload?.trees_gifted
                ? ` · ${payload.trees_gifted} already gifted`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground shrink-0"
            aria-label="Close"
          >
            <IoClose size={22} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {checkout ? (
            <TreePayment
              treeData={checkout}
              climateEventId={eventId}
              climateEventTitle={payload?.title || event.title}
              giftForUser={
                payload?.host_id
                  ? {
                      id: Number(payload.host_id),
                      name: payload.host_name || "",
                    }
                  : null
              }
              onBack={() => setCheckout(null)}
              onSuccess={() => {
                toast.success("Trees gifted for this day’s activities");
                onGifted?.();
                onClose?.();
              }}
            />
          ) : loading ? (
            <p className="text-sm text-muted py-8 text-center">
              Loading available trees…
            </p>
          ) : projects.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-foreground font-medium">
                No tree options for this day yet
              </p>
              <p className="text-xs text-muted max-w-xs mx-auto">
                The host can attach a planting project when scheduling, or
                verified Climate Wavers projects will appear here once available.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-muted mb-2">
                  {payload?.linked_project
                    ? "Day planting project"
                    : "Available projects for this day"}
                </p>
                <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {projects.map((project) => {
                    const active =
                      selectedProject &&
                      String(selectedProject.id) === String(project.id);
                    const specs = normalizeTreeSpecies(project.tree_species);
                    const left = specs.reduce((sum, s) => {
                      const rem = speciesRemaining(s);
                      return sum + (rem != null ? rem : 0);
                    }, 0);
                    return (
                      <li key={project.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedProject(project)}
                          className={`w-full text-left border px-3 py-3 transition-colors ${
                            active
                              ? "border-primary bg-[var(--cw-overlay-soft)]"
                              : "border-border hover:bg-[var(--cw-overlay-soft)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {project.name}
                              </p>
                              <p className="text-[11px] text-muted mt-0.5">
                                {[project.city, project.country]
                                  .filter(Boolean)
                                  .join(", ")}
                                {project.tree_price != null
                                  ? ` · $${Number(project.tree_price).toLocaleString()}/tree`
                                  : ""}
                              </p>
                            </div>
                            {left > 0 ? (
                              <span className="text-[10px] text-muted shrink-0 tabular-nums">
                                {left.toLocaleString()} left
                              </span>
                            ) : null}
                          </div>
                          {specs.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {specs.slice(0, 6).map((s) => {
                                const rem = speciesRemaining(s);
                                const soldOut = rem != null && rem <= 0;
                                return (
                                  <span
                                    key={s.name}
                                    className={`text-[10px] border px-1.5 py-0.5 ${
                                      soldOut
                                        ? "border-border text-muted line-through"
                                        : "border-border text-foreground"
                                    }`}
                                  >
                                    {s.name}
                                    {rem != null ? ` · ${rem}` : ""}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-muted">
                              Mixed species available
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {selectedProject ? (
                <div className="border border-border bg-background p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Species available for this day
                  </p>
                  {availableSpecies.length === 0 && species.length > 0 ? (
                    <p className="text-xs text-muted">
                      Inventory for listed species is currently exhausted.
                    </p>
                  ) : availableSpecies.length === 0 ? (
                    <p className="text-xs text-muted">
                      You can plant any available tree in{" "}
                      {selectedProject.name} for this day.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {availableSpecies.map((s) => {
                        const rem = speciesRemaining(s);
                        return (
                          <li
                            key={s.name}
                            className="flex justify-between gap-2 text-sm text-muted"
                          >
                            <span className="text-foreground">{s.name}</span>
                            <span className="tabular-nums shrink-0">
                              {rem != null
                                ? `${rem.toLocaleString()} available`
                                : "Available"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!selectedProject}
                onClick={startCheckout}
                className="w-full h-12 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Continue to buy trees for this day
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DayActivityTreeGiftModal;
