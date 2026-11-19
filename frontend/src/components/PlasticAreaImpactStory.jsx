import { useMemo } from "react";
import {
  IoWaterOutline,
  IoTrashOutline,
  IoShieldCheckmarkOutline,
  IoMapOutline,
} from "react-icons/io5";

/**
 * Rough PET 500ml bottle mass ≈ 0.025–0.03 kg empty; use 0.028 for storytelling.
 * Not a lab metric — an accessible “what this place feels like” translation.
 */
const KG_PER_BOTTLE = 0.028;

function bottlesFromKg(kg) {
  const n = Math.max(0, Number(kg) || 0) / KG_PER_BOTTLE;
  if (n < 1) return 0;
  return Math.round(n);
}

function formatCompact(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return v.toLocaleString();
}

/**
 * Place-based impact story for a Plastic Pulse public project page.
 */
export default function PlasticAreaImpactStory({ project, place }) {
  const story = useMemo(() => {
    const impact = project?.impact || {};
    const hotspots = Array.isArray(project?.hotspots) ? project.hotspots : [];
    const recoveries = Array.isArray(project?.recent_recoveries)
      ? project.recent_recoveries
      : [];

    const recovered = Number(
      impact.recovered_kg ?? project?.recovered_kg ?? 0
    );
    const goal = Number(impact.goal_kg ?? project?.goal_kg ?? 0);
    const sponsored = Number(impact.sponsored_kg || 0);
    const certificates = Number(impact.certificate_count || 0);
    const drainOpen = Number(impact.drain_hotspots_open || 0);
    const clearedSites = hotspots.filter((h) => h.status === "cleared").length;
    const drainSites = hotspots.filter((h) => h.drain_related).length;
    const bagsDone = recoveries.filter(
      (r) => r.status === "intake_confirmed" || r.status === "cbo_verified"
    ).length;
    const bagsInFlight = recoveries.filter(
      (r) => r.status === "submitted" || r.status === "queued_offline"
    ).length;
    const bottles = bottlesFromKg(recovered);
    const progress =
      goal > 0 ? Math.min(100, Math.round((recovered / goal) * 100)) : 0;

    const polymers = Array.isArray(impact.polymer_breakdown)
      ? impact.polymer_breakdown
      : [];
    const topPolymer = [...polymers].sort(
      (a, b) => Number(b.kg || 0) - Number(a.kg || 0)
    )[0];

    return {
      recovered,
      goal,
      sponsored,
      certificates,
      drainOpen,
      clearedSites,
      drainSites,
      bagsDone,
      bagsInFlight,
      bottles,
      progress,
      hotspotCount: hotspots.length,
      topPolymer,
    };
  }, [project]);

  if (!project) return null;

  const placeLabel = place || "this neighborhood";
  const headline =
    story.recovered > 0
      ? `${formatCompact(story.recovered)} kg already pulled from ${placeLabel}`
      : `Cleanup mapped across ${placeLabel}`;

  const beat =
    story.recovered > 0
      ? `That is roughly ${formatCompact(story.bottles)} plastic bottles kept out of drains, alleys, and waterways — verified bag by bag.`
      : `As collectors log bags with GPS, this page will show the kilos leaving ${placeLabel} and the drains coming clear.`;

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Impact on this place</p>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mt-1 leading-snug">
          {headline}
        </h2>
        <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">{beat}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-px bg-border border border-border">
        {[
          {
            Icon: IoTrashOutline,
            label: "Recovered",
            value: `${formatCompact(story.recovered)} kg`,
            note:
              story.goal > 0
                ? `${story.progress}% of ${formatCompact(story.goal)} kg goal`
                : "Verified after recycler intake",
          },
          {
            Icon: IoWaterOutline,
            label: "Bottle-scale story",
            value: formatCompact(story.bottles),
            note: "≈ 500 ml bottles kept out of the system",
          },
          {
            Icon: IoMapOutline,
            label: "Sites on the map",
            value: String(story.hotspotCount),
            note:
              story.clearedSites > 0
                ? `${story.clearedSites} cleared · ${story.drainSites} drain/flood`
                : story.drainSites > 0
                  ? `${story.drainSites} drain / flood risk pins`
                  : "Hotspots pinned by the CBO",
          },
          {
            Icon: IoShieldCheckmarkOutline,
            label: "Proof closed",
            value: String(story.certificates || story.bagsDone),
            note:
              story.certificates > 0
                ? "Certificates issued after intake"
                : story.bagsInFlight > 0
                  ? `${story.bagsInFlight} bag(s) awaiting verify / intake`
                  : "Chain of custody from pin → bag → yard",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-surface p-4 sm:p-5 flex gap-3 items-start"
          >
            <item.Icon className="text-primary shrink-0 mt-0.5" size={22} aria-hidden />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {item.label}
              </p>
              <p className="text-2xl font-semibold text-foreground tabular-nums mt-0.5">
                {item.value}
              </p>
              <p className="text-xs text-muted mt-1 leading-snug">{item.note}</p>
            </div>
          </div>
        ))}
      </div>

      {story.drainOpen > 0 || story.sponsored > 0 || story.topPolymer ? (
        <div className="border border-border bg-surface px-4 py-3 text-sm text-muted leading-relaxed">
          {story.drainOpen > 0 ? (
            <p>
              <span className="text-foreground font-medium">
                {story.drainOpen} drain / flood hotspot
                {story.drainOpen === 1 ? "" : "s"}
              </span>{" "}
              still open on the map — sponsoring kilos funds the next clearances in{" "}
              {placeLabel}.
            </p>
          ) : null}
          {story.sponsored > 0 ? (
            <p className={story.drainOpen > 0 ? "mt-2" : undefined}>
              Community sponsorship so far:{" "}
              <span className="text-foreground font-medium">
                {formatCompact(story.sponsored)} kg funded
              </span>
              .
            </p>
          ) : null}
          {story.topPolymer && Number(story.topPolymer.kg) > 0 ? (
            <p
              className={
                story.drainOpen > 0 || story.sponsored > 0 ? "mt-2" : undefined
              }
            >
              Most common material logged:{" "}
              <span className="text-foreground font-medium">
                {story.topPolymer.polymer || story.topPolymer.label || "mixed"} (
                {formatCompact(story.topPolymer.kg)} kg)
              </span>
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
